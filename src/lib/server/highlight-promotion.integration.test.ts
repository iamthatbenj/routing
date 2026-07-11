import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { routeCorridorCells } from '$lib/route-corridors';
import { createMigratedTestDatabase } from './test-db';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { findHighlightsByH3Cells, listHighlights } from './highlights';
import { h3CellsForHighlight, promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Candidate Highlight promotion', () => {
  beforeEach(async () => {
    const testDb = await createMigratedTestDatabase();
    db = testDb.db;
    cleanup = testDb.cleanup;
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    vi.clearAllMocks();
  });

  it('requires human-reviewed promotion evidence before creating a route-usable Highlight', async () => {
    const candidateId = await importAcadiaCandidate();

    await expect(
      promoteCandidateHighlight(db, candidateId, {
        ...reviewForAcadia(),
        evidence: { ...reviewForAcadia().evidence, routeInfluence: '' }
      })
    ).rejects.toThrow('Promotion requires review evidence: routeInfluence.');

    expect((await listHighlights()).map((highlight) => highlight.name)).not.toContain('Acadia National Park');
    expect(await candidateStatus(candidateId)).toBe('imported');
  });

  it('promotes a reviewed Candidate Highlight with provenance and generated H3 cells', async () => {
    const candidateId = await importAcadiaCandidate();
    const result = await promoteCandidateHighlight(db, candidateId, reviewForAcadia());

    expect(result).toEqual({
      promoted: true,
      highlightId: 'acadia-national-park-me',
      h3Cells: h3CellsForHighlight(44.3386, -68.2733, 5)
    });

    const highlight = await promotedHighlightRow('acadia-national-park-me');
    expect(highlight).toMatchObject({
      name: 'Acadia National Park',
      category: 'nature',
      strength: 96,
      visit_effort: 'Full Day+',
      candidate_highlight_id: candidateId
    });
    expect(JSON.parse(String(highlight.source_provenance_json))).toMatchObject({
      candidateHighlightId: candidateId,
      sourceSystem: 'turso-poi',
      sourceDatabase: 'regional-pois',
      sourceRecordId: 'poi-acadia',
      candidateEvidence: { sourceRank: 0.98 },
      review: {
        reviewedBy: 'maintainer',
        evidence: {
          travelRelevance: 'National park anchor for the Boston to Bar Harbor proof corridor.',
          stableIdentity: 'NPS-managed unit with stable public identity.',
          coordinateCheck: 'Coordinates are inside Mount Desert Island near Bar Harbor.',
          categoryRationale: 'Nature Highlight because appeal is public lands and outdoor scenery.',
          routeInfluence: 'Strong enough to influence Route Option comparison near Bar Harbor.'
        }
      }
    });
    expect(await generatedH3Cells('acadia-national-park-me')).toEqual(result.h3Cells);
    expect(await candidateStatus(candidateId)).toBe('promoted');
  });

  it('keeps promotion and H3 generation idempotent', async () => {
    const candidateId = await importAcadiaCandidate();
    const first = await promoteCandidateHighlight(db, candidateId, reviewForAcadia());
    const second = await promoteCandidateHighlight(db, candidateId, reviewForAcadia());

    expect(first.promoted).toBe(true);
    expect(second.promoted).toBe(false);
    expect(await highlightCount('acadia-national-park-me')).toBe(1);
    expect(await generatedH3Cells('acadia-national-park-me')).toEqual(first.h3Cells);
  });

  it('makes a promoted second-region Highlight visible to map and route-to-Highlight matching paths', async () => {
    const candidateId = await importAcadiaCandidate();
    await promoteCandidateHighlight(db, candidateId, reviewForAcadia());

    const mappedHighlights = await listHighlights();
    const routeGeometry = {
      type: 'LineString',
      coordinates: [
        [-68.3, 44.31],
        [-68.2733, 44.3386],
        [-68.2, 44.39]
      ]
    };
    const scoredHighlights = await findHighlightsByH3Cells(routeCorridorCells(routeGeometry), 5);

    expect(mappedHighlights.map((highlight) => highlight.name)).toContain('Acadia National Park');
    expect(scoredHighlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'acadia-national-park-me',
          name: 'Acadia National Park',
          category: 'nature',
          strength: 96,
          visitEffort: 'Full Day+'
        })
      ])
    );
  });
});

async function importAcadiaCandidate() {
  const normalized = normalizeSourcePoiRecords(
    [
      {
        sourceRecordId: 'poi-acadia',
        name: 'Acadia National Park',
        latitude: 44.3386,
        longitude: -68.2733,
        sourceCategory: 'national_park',
        sourceUrl: 'https://example.test/acadia',
        description: 'NPS unit near Bar Harbor.',
        evidence: { sourceRank: 0.98 }
      }
    ],
    { sourceSystem: 'turso-poi', sourceDatabase: 'regional-pois' }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);
  return normalized.candidates[0].id;
}

function reviewForAcadia(): PromotionReview {
  return {
    highlightId: 'acadia-national-park-me',
    category: 'nature',
    strength: 96,
    visitEffort: 'Full Day+',
    description: 'Major coastal Nature Highlight near Bar Harbor.',
    reviewedBy: 'maintainer',
    reviewedAt: '2026-07-11T00:00:00.000Z',
    evidence: {
      travelRelevance: 'National park anchor for the Boston to Bar Harbor proof corridor.',
      stableIdentity: 'NPS-managed unit with stable public identity.',
      coordinateCheck: 'Coordinates are inside Mount Desert Island near Bar Harbor.',
      categoryRationale: 'Nature Highlight because appeal is public lands and outdoor scenery.',
      routeInfluence: 'Strong enough to influence Route Option comparison near Bar Harbor.'
    }
  };
}

async function promotedHighlightRow(highlightId: string) {
  const result = await db.execute({
    sql: `
      SELECT id, name, category, strength, visit_effort, candidate_highlight_id, source_provenance_json
      FROM highlights
      WHERE id = ?
      LIMIT 1
    `,
    args: [highlightId]
  });
  const row = result.rows[0];
  if (!row) throw new Error(`Missing Highlight: ${highlightId}`);
  return row;
}

async function generatedH3Cells(highlightId: string) {
  const result = await db.execute({
    sql: `
      SELECT cell
      FROM highlight_h3_cells
      WHERE highlight_id = ? AND resolution = 5
      ORDER BY cell
    `,
    args: [highlightId]
  });
  return result.rows.map((row) => String(row.cell));
}

async function candidateStatus(candidateId: string) {
  const result = await db.execute({
    sql: 'SELECT status FROM candidate_highlights WHERE id = ? LIMIT 1',
    args: [candidateId]
  });
  return String(result.rows[0].status);
}

async function highlightCount(highlightId: string) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM highlights WHERE id = ?',
    args: [highlightId]
  });
  return Number(result.rows[0].count);
}
