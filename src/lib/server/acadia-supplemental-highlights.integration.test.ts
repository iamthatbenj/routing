import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import acadiaSource from '../../../data/candidate-highlights/acadia-nps-supplement.json';
import acadiaPromotions from '../../../data/highlight-promotions/acadia-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { findHighlightsByH3Cells, listHighlights } from './highlights';
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
import { routeCorridorCells } from '$lib/route-corridors';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Acadia supplemental Highlight set', () => {
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

  it('defines a bounded NPS-backed Acadia Candidate Highlight set without Food Highlights', () => {
    const normalized = normalizeAcadiaSource();

    expect(normalized.skipped).toEqual([]);
    expect(normalized.ambiguous).toEqual([]);
    expect(normalized.candidates).toHaveLength(10);
    expect(normalized.candidates.map((candidate) => candidate.proposedCategory)).toEqual(
      expect.arrayContaining(['nature', 'landmark', 'scenic_segment'])
    );
    expect(normalized.candidates.map((candidate) => candidate.proposedCategory)).not.toContain('food');
    expect(normalized.candidates.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining(['Acadia National Park', 'Cadillac Mountain', 'Park Loop Road', 'Bass Harbor Head Light Station'])
    );
  });

  it('imports Acadia supplemental Candidate Highlights idempotently', async () => {
    const normalized = normalizeAcadiaSource();

    const first = await importCandidateHighlights(db, normalized.candidates, normalized);
    const second = await importCandidateHighlights(db, normalized.candidates, normalized);

    expect(first.created).toBe(10);
    expect(first.updated).toBe(0);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(10);
    expect(await candidateCount('nps', 'acad-nps-supplement')).toBe(10);
  });

  it('promotes the reviewed Acadia set with generated H3 cells and route-matching visibility', async () => {
    const normalized = normalizeAcadiaSource();
    await importCandidateHighlights(db, normalized.candidates, normalized);

    for (const promotion of acadiaPromotions) {
      await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
    }

    const promotedHighlights = await listHighlights();
    const promotedNames = promotedHighlights.map((highlight) => highlight.name);
    expect(promotedNames).toEqual(expect.arrayContaining(['Acadia National Park', 'Cadillac Mountain', 'Park Loop Road']));
    expect(await promotedAcadiaCount()).toBe(10);
    expect(await generatedH3CellCount('acadia-national-park-me')).toBe(7);
    expect(await generatedH3CellCount('park-loop-road-me')).toBe(7);

    const routeGeometry = {
      type: 'LineString',
      coordinates: [
        [-68.25, 44.35],
        [-68.2258, 44.3512],
        [-68.205, 44.329],
        [-68.1896, 44.3209]
      ]
    };
    const matchedHighlights = await findHighlightsByH3Cells(routeCorridorCells(routeGeometry), 5);
    expect(matchedHighlights.map((highlight) => highlight.name)).toEqual(
      expect.arrayContaining(['Cadillac Mountain', 'Park Loop Road', 'Thunder Hole'])
    );
  });
});

function normalizeAcadiaSource() {
  return normalizeSourcePoiRecords(
    acadiaSource.records,
    { sourceSystem: acadiaSource.sourceSystem, sourceDatabase: acadiaSource.sourceDatabase }
  );
}

async function candidateCount(sourceSystem: string, sourceDatabase: string) {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS total_count
      FROM candidate_highlights
      WHERE source_system = ? AND source_database = ?
    `,
    args: [sourceSystem, sourceDatabase]
  });
  return Number(result.rows[0].total_count);
}

async function promotedAcadiaCount() {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS total_count
      FROM highlights
      WHERE candidate_highlight_id LIKE 'nps-acad-nps-supplement-%'
    `
  });
  return Number(result.rows[0].total_count);
}

async function generatedH3CellCount(highlightId: string) {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS total_count
      FROM highlight_h3_cells
      WHERE highlight_id = ? AND resolution = 5
    `,
    args: [highlightId]
  });
  return Number(result.rows[0].total_count);
}
