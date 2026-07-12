import { readFile } from 'node:fs/promises';
import { createDatabaseClient, databaseConfig, loadDotEnv, printDatabaseTarget } from './db-utils.mjs';

const DEFAULT_SOURCE_FILE = 'data/candidate-highlights/acadia-nps-supplement.json';
const CATEGORY_ALIASES = {
  nature: 'nature',
  park: 'nature',
  national_park: 'nature',
  'national-park': 'nature',
  landmark: 'landmark',
  viewpoint: 'landmark',
  scenic: 'landmark',
  scenic_segment: 'scenic_segment',
  'scenic-segment': 'scenic_segment',
  scenic_route: 'scenic_segment',
  'scenic-route': 'scenic_segment',
  food: 'food',
  restaurant: 'food',
  cafe: 'food'
};

loadDotEnv();
const options = parseOptions(process.argv.slice(2));
const config = databaseConfig();
printDatabaseTarget(config);

const db = createDatabaseClient(config);

try {
  const source = JSON.parse(await readFile(options.file, 'utf8'));
  const normalized = normalizeSupplementalSource(source);
  const summary = await importCandidates(db, normalized.candidates, normalized);

  console.log(`Supplemental Candidate Highlight import summary:`);
  console.log(`  Source: ${source.sourceSystem}/${source.sourceDatabase}`);
  console.log(`  Created: ${summary.created}`);
  console.log(`  Updated: ${summary.updated}`);
  console.log(`  Skipped: ${summary.skipped.length}`);
  console.log(`  Ambiguous: ${summary.ambiguous.length}`);

  for (const skipped of summary.skipped) console.log(`  Skipped ${skipped.sourceRecordId}: ${skipped.reason}`);
  for (const ambiguous of summary.ambiguous) console.log(`  Ambiguous ${ambiguous.sourceRecordId}: ${ambiguous.reason}`);
} finally {
  await db.close();
}

function parseOptions(args) {
  const options = { file: DEFAULT_SOURCE_FILE };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('--file=')) options.file = arg.slice('--file='.length);
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function normalizeSupplementalSource(source) {
  if (!source?.sourceSystem?.trim()) throw new Error('Supplemental source requires sourceSystem.');
  if (!source?.sourceDatabase?.trim()) throw new Error('Supplemental source requires sourceDatabase.');
  if (!Array.isArray(source.records)) throw new Error('Supplemental source requires records array.');

  const bySourceRecordId = new Map();
  for (const record of source.records) {
    const sourceRecordId = String(record.sourceRecordId ?? '').trim();
    if (!sourceRecordId) continue;
    bySourceRecordId.set(sourceRecordId, [...(bySourceRecordId.get(sourceRecordId) ?? []), record]);
  }

  const candidates = [];
  const skipped = [];
  const ambiguous = [];

  for (const [sourceRecordId, records] of bySourceRecordId) {
    if (records.length > 1) {
      ambiguous.push({ sourceRecordId, reason: 'duplicate source identity in supplemental file' });
      continue;
    }

    const record = records[0];
    const name = String(record.name ?? '').trim();
    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);
    const proposedCategory = proposedCategoryFor(record.sourceCategory);

    if (!name) {
      skipped.push({ sourceRecordId, reason: 'missing name' });
      continue;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skipped.push({ sourceRecordId, reason: 'missing or invalid coordinates' });
      continue;
    }
    if (proposedCategory === 'food') {
      skipped.push({ sourceRecordId, reason: 'Food Highlights are deferred from TB17 Acadia supplement' });
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
      sourceUrl: nullableString(record.sourceUrl ?? source.sourceUrl),
      sourceCategory: nullableString(record.sourceCategory),
      evidence: {
        ...(record.evidence ?? {}),
        sourceSystem: source.sourceSystem,
        sourceDatabase: source.sourceDatabase,
        sourceUrl: record.sourceUrl ?? source.sourceUrl ?? null,
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
  return CATEGORY_ALIASES[normalized] ?? 'unknown';
}

function nullableString(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function printHelp() {
  console.log(`Import supplemental source-backed Candidate Highlights.

Usage:
  npm run db:import:supplemental-candidates -- [options]

Options:
  --file=path   Supplemental Candidate Highlight source JSON. Default: ${DEFAULT_SOURCE_FILE}
`);
}
