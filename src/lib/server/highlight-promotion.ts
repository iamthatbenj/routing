import type { Client } from '@libsql/client';
import { gridDisk, latLngToCell } from 'h3-js';

export type VisitEffort = 'Quick Stop' | 'Short Visit' | 'Half Day' | 'Full Day+';
export type HighlightCategory = 'nature' | 'landmark' | 'food' | 'scenic_segment';

export type PromotionReview = {
  highlightId: string;
  category: HighlightCategory;
  strength: number;
  visitEffort: VisitEffort;
  description: string;
  reviewedBy: string;
  reviewedAt?: string;
  evidence: {
    travelRelevance: string;
    stableIdentity: string;
    coordinateCheck: string;
    categoryRationale: string;
    routeInfluence: string;
  };
  h3Resolution?: number;
};

export type PromoteCandidateHighlightResult = {
  promoted: boolean;
  highlightId: string;
  h3Cells: string[];
};

type CandidateHighlightRow = {
  id: string;
  name: string;
  proposed_category: string;
  latitude: number;
  longitude: number;
  source_system: string;
  source_database: string;
  source_record_id: string;
  source_url: string | null;
  source_category: string | null;
  evidence_json: string;
  description: string;
};

export async function promoteCandidateHighlight(
  client: Client,
  candidateHighlightId: string,
  review: PromotionReview
): Promise<PromoteCandidateHighlightResult> {
  validatePromotionReview(review);

  const candidate = await findCandidateHighlight(client, candidateHighlightId);
  const now = new Date().toISOString();
  const reviewedAt = review.reviewedAt ?? now;
  const h3Resolution = review.h3Resolution ?? 5;
  const h3Cells = h3CellsForHighlight(candidate.latitude, candidate.longitude, h3Resolution);
  const sourceProvenance = buildSourceProvenance(candidate, review);

  const existing = await client.execute({
    sql: 'SELECT id FROM highlights WHERE id = ? LIMIT 1',
    args: [review.highlightId]
  });

  await client.execute({
    sql: `
      INSERT INTO highlights (
        id, name, category, latitude, longitude, strength, visit_effort,
        endpoint_context_place_id, description, candidate_highlight_id,
        source_provenance_json, reviewed_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        strength = excluded.strength,
        visit_effort = excluded.visit_effort,
        description = excluded.description,
        candidate_highlight_id = excluded.candidate_highlight_id,
        source_provenance_json = excluded.source_provenance_json,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at
    `,
    args: [
      review.highlightId,
      candidate.name,
      review.category,
      candidate.latitude,
      candidate.longitude,
      review.strength,
      review.visitEffort,
      review.description.trim(),
      candidate.id,
      JSON.stringify(sourceProvenance),
      reviewedAt,
      now
    ]
  });

  await replaceHighlightH3Cells(client, review.highlightId, h3Resolution, h3Cells);

  await client.execute({
    sql: `
      UPDATE candidate_highlights
      SET status = 'promoted', updated_at = ?
      WHERE id = ?
    `,
    args: [now, candidate.id]
  });

  return { promoted: existing.rows.length === 0, highlightId: review.highlightId, h3Cells };
}

export function h3CellsForHighlight(latitude: number, longitude: number, resolution = 5) {
  return [...gridDisk(latLngToCell(latitude, longitude, resolution), 1)].sort();
}

async function findCandidateHighlight(client: Client, candidateHighlightId: string): Promise<CandidateHighlightRow> {
  const result = await client.execute({
    sql: `
      SELECT id, name, proposed_category, latitude, longitude, source_system, source_database,
        source_record_id, source_url, source_category, evidence_json, description
      FROM candidate_highlights
      WHERE id = ?
      LIMIT 1
    `,
    args: [candidateHighlightId]
  });

  const row = result.rows[0];
  if (!row) throw new Error(`Candidate Highlight not found: ${candidateHighlightId}`);

  return {
    id: String(row.id),
    name: String(row.name),
    proposed_category: String(row.proposed_category),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    source_system: String(row.source_system),
    source_database: String(row.source_database),
    source_record_id: String(row.source_record_id),
    source_url: row.source_url ? String(row.source_url) : null,
    source_category: row.source_category ? String(row.source_category) : null,
    evidence_json: String(row.evidence_json ?? '{}'),
    description: String(row.description ?? '')
  };
}

function validatePromotionReview(review: PromotionReview) {
  if (!review.highlightId.trim()) throw new Error('Promotion requires a reviewed Highlight identity.');
  if (!review.description.trim()) throw new Error('Promotion requires a reviewed Highlight description.');
  if (!review.reviewedBy.trim()) throw new Error('Promotion requires a human reviewer.');
  if (!Number.isInteger(review.strength) || review.strength < 1 || review.strength > 100) {
    throw new Error('Promotion requires reviewed Highlight strength from 1 to 100.');
  }

  for (const [field, value] of Object.entries(review.evidence)) {
    if (!String(value).trim()) {
      throw new Error(`Promotion requires review evidence: ${field}.`);
    }
  }
}

async function replaceHighlightH3Cells(client: Client, highlightId: string, resolution: number, h3Cells: string[]) {
  await client.execute({
    sql: 'DELETE FROM highlight_h3_cells WHERE highlight_id = ? AND resolution = ?',
    args: [highlightId, resolution]
  });

  for (const cell of h3Cells) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO highlight_h3_cells (highlight_id, resolution, cell) VALUES (?, ?, ?)',
      args: [highlightId, resolution, cell]
    });
  }
}

function buildSourceProvenance(candidate: CandidateHighlightRow, review: PromotionReview) {
  return {
    candidateHighlightId: candidate.id,
    sourceSystem: candidate.source_system,
    sourceDatabase: candidate.source_database,
    sourceRecordId: candidate.source_record_id,
    sourceUrl: candidate.source_url,
    sourceCategory: candidate.source_category,
    candidateEvidence: safeJson(candidate.evidence_json),
    review: {
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt ?? null,
      evidence: review.evidence
    }
  };
}

function safeJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
