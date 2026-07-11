import { createClient } from '@libsql/client';
import { createDatabaseClient, databaseConfig, loadDotEnv, printDatabaseTarget } from './db-utils.mjs';

const DEFAULT_POI_QUERY = `
  SELECT
    id AS source_record_id,
    name,
    latitude,
    longitude,
    category AS source_category,
    url AS source_url,
    description
  FROM pois
  WHERE latitude BETWEEN 42.2 AND 45.1
    AND longitude BETWEEN -71.5 AND -67.5
`;

const categoryAliases = {
  national_park: 'nature',
  'national-park': 'nature',
  park: 'nature',
  natural: 'nature',
  nature: 'nature',
  scenic: 'landmark',
  viewpoint: 'landmark',
  attraction: 'landmark',
  museum: 'landmark',
  historic: 'landmark',
  landmark: 'landmark',
  scenic_segment: 'scenic_segment',
  'scenic-segment': 'scenic_segment',
  scenic_route: 'scenic_segment',
  'scenic-route': 'scenic_segment',
  road: 'scenic_segment',
  restaurant: 'food',
  food: 'food',
  cafe: 'food'
};

loadDotEnv();

const appConfig = databaseConfig();
const poiConfig = poiDatabaseConfig();

console.log('Routing app database:');
printDatabaseTarget(appConfig, (line) => console.log(`  ${line}`));
console.log('POI source database:');
console.log(`  Database URL: ${redactDatabaseUrl(poiConfig.url)}`);
console.log(`  Auth token configured: ${poiConfig.authToken ? 'yes' : 'no'}`);
console.log(`  Source database label: ${poiConfig.sourceDatabase}`);

const appDb = createDatabaseClient(appConfig);
const poiDb = createClient({ url: poiConfig.url, authToken: poiConfig.authToken });

try {
  const sourceRows = await poiDb.execute(process.env.POI_IMPORT_QUERY ?? DEFAULT_POI_QUERY);
  const normalized = normalizeSourcePoiRecords(
    sourceRows.rows.map((row) => ({
      sourceRecordId: String(row.source_record_id ?? ''),
      name: String(row.name ?? ''),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      sourceCategory: nullableString(row.source_category),
      sourceUrl: nullableString(row.source_url),
      description: nullableString(row.description),
      evidence: row.evidence_json ? safeJson(String(row.evidence_json)) : {}
    })),
    { sourceSystem: 'turso-poi', sourceDatabase: poiConfig.sourceDatabase }
  );
  const summary = await importCandidates(appDb, normalized.candidates, normalized);

  console.log(`Candidate Highlight import summary:`);
  console.log(`  Created: ${summary.created}`);
  console.log(`  Updated: ${summary.updated}`);
  console.log(`  Skipped: ${summary.skipped.length}`);
  console.log(`  Ambiguous: ${summary.ambiguous.length}`);

  for (const skipped of summary.skipped.slice(0, 20)) {
    console.log(`  Skipped ${skipped.sourceRecordId}: ${skipped.reason}`);
  }
  for (const ambiguous of summary.ambiguous.slice(0, 20)) {
    console.log(`  Ambiguous ${ambiguous.sourceRecordId}: ${ambiguous.reason}`);
  }
} finally {
  await poiDb.close();
  await appDb.close();
}

function poiDatabaseConfig() {
  const url = process.env.POI_TURSO_DATABASE_URL ?? process.env.POI_DATABASE_URL;
  if (!url) {
    console.error('Missing POI_TURSO_DATABASE_URL or POI_DATABASE_URL for the source POI database.');
    process.exit(1);
  }

  return {
    url,
    authToken: process.env.POI_TURSO_AUTH_TOKEN ?? process.env.POI_DATABASE_AUTH_TOKEN,
    sourceDatabase: process.env.POI_SOURCE_DATABASE_LABEL ?? 'regional-pois'
  };
}

function normalizeSourcePoiRecords(records, source) {
  const bySourceRecordId = new Map();

  for (const record of records) {
    const sourceRecordId = String(record.sourceRecordId ?? '').trim();
    if (!sourceRecordId) continue;
    bySourceRecordId.set(sourceRecordId, [...(bySourceRecordId.get(sourceRecordId) ?? []), record]);
  }

  const candidates = [];
  const skipped = [];
  const ambiguous = [];

  for (const [sourceRecordId, sourceRecords] of bySourceRecordId) {
    if (sourceRecords.length > 1) {
      ambiguous.push({ sourceRecordId, reason: 'duplicate source identity in import batch' });
      continue;
    }

    const record = sourceRecords[0];
    const name = String(record.name ?? '').trim();
    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);

    if (!name) {
      skipped.push({ sourceRecordId, reason: 'missing name' });
      continue;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skipped.push({ sourceRecordId, reason: 'missing or invalid coordinates' });
      continue;
    }

    const proposedCategory = proposedCategoryFor(record.sourceCategory);
    if (proposedCategory === 'food') {
      skipped.push({ sourceRecordId, reason: 'Food Highlights are deferred from TB16' });
      continue;
    }

    candidates.push({
      id: `${slug(source.sourceSystem)}-${slug(source.sourceDatabase)}-${slug(sourceRecordId)}`,
      name,
      proposedCategory,
      latitude,
      longitude,
      sourceSystem: source.sourceSystem,
      sourceDatabase: source.sourceDatabase,
      sourceRecordId,
      sourceUrl: nullableString(record.sourceUrl),
      sourceCategory: nullableString(record.sourceCategory),
      evidence: {
        ...(record.evidence ?? {}),
        importedName: name,
        importedCoordinates: { latitude, longitude }
      },
      description: String(record.description ?? '').trim()
    });
  }

  return { candidates: candidates.sort((left, right) => left.name.localeCompare(right.name)), skipped, ambiguous };
}

async function importCandidates(client, candidates, initialSummary) {
  const summary = {
    created: 0,
    updated: 0,
    skipped: [...initialSummary.skipped],
    ambiguous: [...initialSummary.ambiguous]
  };
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    const existing = await client.execute({
      sql: `
        SELECT id
        FROM candidate_highlights
        WHERE source_system = ? AND source_database = ? AND source_record_id = ?
        LIMIT 1
      `,
      args: [candidate.sourceSystem, candidate.sourceDatabase, candidate.sourceRecordId]
    });

    await client.execute({
      sql: `
        INSERT INTO candidate_highlights (
          id, name, proposed_category, latitude, longitude,
          source_system, source_database, source_record_id, source_url, source_category,
          evidence_json, description, status, ambiguity_reason, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', NULL, ?)
        ON CONFLICT(source_system, source_database, source_record_id) DO UPDATE SET
          name = excluded.name,
          proposed_category = excluded.proposed_category,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          source_url = excluded.source_url,
          source_category = excluded.source_category,
          evidence_json = excluded.evidence_json,
          description = excluded.description,
          updated_at = excluded.updated_at
      `,
      args: [
        candidate.id,
        candidate.name,
        candidate.proposedCategory,
        candidate.latitude,
        candidate.longitude,
        candidate.sourceSystem,
        candidate.sourceDatabase,
        candidate.sourceRecordId,
        candidate.sourceUrl,
        candidate.sourceCategory,
        JSON.stringify(candidate.evidence),
        candidate.description,
        now
      ]
    });

    if (existing.rows.length > 0) summary.updated += 1;
    else summary.created += 1;
  }

  return summary;
}

function proposedCategoryFor(sourceCategory) {
  const normalized = slug(sourceCategory ?? '');
  return categoryAliases[normalized] ?? 'unknown';
}

function nullableString(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function redactDatabaseUrl(url) {
  if (url.startsWith('file:')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|auth|password|secret|key/i.test(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/(token|auth|password|secret|key)=([^&]+)/gi, '$1=***');
  }
}
