import { readFile } from 'node:fs/promises';
import { gridDisk, latLngToCell } from 'h3-js';
import { createDatabaseClient, databaseConfig, loadDotEnv, printDatabaseTarget } from './db-utils.mjs';

loadDotEnv();

const reviewFile = reviewFilePath();
const config = databaseConfig();
printDatabaseTarget(config);

const db = createDatabaseClient(config);

try {
  const promotions = JSON.parse(await readFile(reviewFile, 'utf8'));
  if (!Array.isArray(promotions)) throw new Error('Promotion file must contain an array.');

  let created = 0;
  let updated = 0;

  for (const promotion of promotions) {
    const result = await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review);
    if (result.promoted) created += 1;
    else updated += 1;
    console.log(`${result.promoted ? 'Promoted' : 'Updated'} ${result.highlightId} with ${result.h3Cells.length} H3 cells.`);
  }

  console.log(`Reviewed Candidate Highlight promotion summary:`);
  console.log(`  Created Highlights: ${created}`);
  console.log(`  Updated Highlights: ${updated}`);
} finally {
  await db.close();
}

function reviewFilePath() {
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  if (fileArg) return fileArg.slice('--file='.length);
  return 'data/highlight-promotions/reviewed-candidate-highlights.json';
}

async function promoteCandidateHighlight(client, candidateHighlightId, review) {
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

  await client.execute({
    sql: 'DELETE FROM highlight_h3_cells WHERE highlight_id = ? AND resolution = ?',
    args: [review.highlightId, h3Resolution]
  });

  for (const cell of h3Cells) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO highlight_h3_cells (highlight_id, resolution, cell) VALUES (?, ?, ?)',
      args: [review.highlightId, h3Resolution, cell]
    });
  }

  await client.execute({
    sql: "UPDATE candidate_highlights SET status = 'promoted', updated_at = ? WHERE id = ?",
    args: [now, candidate.id]
  });

  return { promoted: existing.rows.length === 0, highlightId: review.highlightId, h3Cells };
}

async function findCandidateHighlight(client, candidateHighlightId) {
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
  return row;
}

function validatePromotionReview(review) {
  if (!review?.highlightId?.trim()) throw new Error('Promotion requires a reviewed Highlight identity.');
  if (!review?.description?.trim()) throw new Error('Promotion requires a reviewed Highlight description.');
  if (!review?.reviewedBy?.trim()) throw new Error('Promotion requires a human reviewer.');
  if (!Number.isInteger(review.strength) || review.strength < 1 || review.strength > 100) {
    throw new Error('Promotion requires reviewed Highlight strength from 1 to 100.');
  }

  const evidence = review.evidence ?? {};
  for (const field of ['travelRelevance', 'stableIdentity', 'coordinateCheck', 'categoryRationale', 'routeInfluence']) {
    if (!String(evidence[field] ?? '').trim()) throw new Error(`Promotion requires review evidence: ${field}.`);
  }
}

function h3CellsForHighlight(latitude, longitude, resolution = 5) {
  return [...gridDisk(latLngToCell(Number(latitude), Number(longitude), resolution), 1)].sort();
}

function buildSourceProvenance(candidate, review) {
  return {
    candidateHighlightId: String(candidate.id),
    sourceSystem: String(candidate.source_system),
    sourceDatabase: String(candidate.source_database),
    sourceRecordId: String(candidate.source_record_id),
    sourceUrl: candidate.source_url ? String(candidate.source_url) : null,
    sourceCategory: candidate.source_category ? String(candidate.source_category) : null,
    candidateEvidence: safeJson(String(candidate.evidence_json ?? '{}')),
    review: {
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt ?? null,
      evidence: review.evidence
    }
  };
}

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
