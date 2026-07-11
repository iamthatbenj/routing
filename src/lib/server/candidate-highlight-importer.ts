import type { Client } from '@libsql/client';

export type ProposedCandidateHighlightCategory = 'nature' | 'landmark' | 'scenic_segment' | 'unknown';

export type SourcePoiRecord = {
  sourceRecordId: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceCategory?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  evidence?: Record<string, unknown> | null;
};

export type CandidateHighlightInput = {
  id: string;
  name: string;
  proposedCategory: ProposedCandidateHighlightCategory;
  latitude: number;
  longitude: number;
  sourceSystem: string;
  sourceDatabase: string;
  sourceRecordId: string;
  sourceUrl: string | null;
  sourceCategory: string | null;
  evidence: Record<string, unknown>;
  description: string;
};

export type CandidateHighlightImportSummary = {
  created: number;
  updated: number;
  skipped: Array<{ sourceRecordId: string; reason: string }>;
  ambiguous: Array<{ sourceRecordId: string; reason: string }>;
};

export type CandidateHighlightSource = {
  sourceSystem: string;
  sourceDatabase: string;
};

const CATEGORY_ALIASES: Record<string, ProposedCandidateHighlightCategory | 'food'> = {
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

export function normalizeSourcePoiRecords(records: SourcePoiRecord[], source: CandidateHighlightSource) {
  const bySourceRecordId = new Map<string, SourcePoiRecord[]>();

  for (const record of records) {
    const sourceRecordId = String(record.sourceRecordId ?? '').trim();
    if (!sourceRecordId) continue;
    bySourceRecordId.set(sourceRecordId, [...(bySourceRecordId.get(sourceRecordId) ?? []), record]);
  }

  const candidates: CandidateHighlightInput[] = [];
  const skipped: CandidateHighlightImportSummary['skipped'] = [];
  const ambiguous: CandidateHighlightImportSummary['ambiguous'] = [];

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
      sourceUrl: normalizeNullableString(record.sourceUrl),
      sourceCategory: normalizeNullableString(record.sourceCategory),
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

export async function importCandidateHighlights(
  client: Client,
  candidates: CandidateHighlightInput[],
  initialSummary: Pick<CandidateHighlightImportSummary, 'skipped' | 'ambiguous'> = { skipped: [], ambiguous: [] }
): Promise<CandidateHighlightImportSummary> {
  const summary: CandidateHighlightImportSummary = {
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

function proposedCategoryFor(sourceCategory: string | null | undefined): ProposedCandidateHighlightCategory | 'food' {
  const normalized = slug(sourceCategory ?? '');
  return CATEGORY_ALIASES[normalized] ?? 'unknown';
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function slug(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}
