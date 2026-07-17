import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { routeCorridorCells } from '$lib/route-corridors';
import restonNiagaraSource from '../../../data/candidate-highlights/reston-niagara-supplement.json';
import restonNiagaraPromotions from '../../../data/highlight-promotions/reston-niagara-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { findHighlightsByH3Cells, listHighlights } from './highlights';
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Reston to Niagara reviewed Highlight promotion', () => {
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

  it('promotes reviewed third-region Candidate Highlights with generated H3 cells and provenance', async () => {
    await importRestonNiagaraCandidates();

    for (const promotion of restonNiagaraPromotions) {
      await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
    }

    const promotedHighlights = await listHighlights();
    const promotedNames = promotedHighlights.map((highlight) => highlight.name);
    expect(promotedNames).toEqual(
      expect.arrayContaining([
        'Harpers Ferry National Historical Park',
        'Gettysburg National Military Park',
        'Pine Creek Gorge',
        'Watkins Glen State Park',
        'Finger Lakes Scenic Route',
        'Niagara Falls State Park'
      ])
    );
    expect(await promotedRestonNiagaraCount()).toBe(12);
    expect(await generatedH3CellCount('gettysburg-national-military-park-pa')).toBe(7);
    expect(await generatedH3CellCount('finger-lakes-scenic-route-ny')).toBe(7);

    const gettysburg = await promotedHighlightRow('gettysburg-national-military-park-pa');
    expect(gettysburg).toMatchObject({
      category: 'landmark',
      strength: 92,
      visit_effort: 'Half Day',
      candidate_highlight_id: 'tb19-supplemental-reston-niagara-source-backed-review-reston-niagara-gettysburg-nmp'
    });
    expect(JSON.parse(String(gettysburg.source_provenance_json))).toMatchObject({
      sourceSystem: restonNiagaraSource.sourceSystem,
      sourceDatabase: restonNiagaraSource.sourceDatabase,
      review: {
        reviewedBy: 'maintainer',
        evidence: {
          categoryRationale: expect.stringContaining('Landmark Highlight'),
          routeInfluence: expect.stringContaining('Promoted with strength 92')
        }
      }
    });
  });

  it('makes promoted third-region Highlights visible to route matching while leaving unpromoted candidates inert', async () => {
    await importRestonNiagaraCandidates();
    await importUnpromotedCandidate();

    for (const promotion of restonNiagaraPromotions) {
      await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
    }

    const routeGeometry = {
      type: 'LineString',
      coordinates: [
        [-77.3411, 38.96872],
        [-77.2311, 39.83093],
        [-77.4558, 41.7001],
        [-76.8795, 42.3736],
        [-79.05671, 43.0945]
      ]
    };
    const matchedHighlights = await findHighlightsByH3Cells(routeCorridorCells(routeGeometry), 5);
    const matchedNames = matchedHighlights.map((highlight) => highlight.name);

    expect(matchedNames).toEqual(expect.arrayContaining(['Gettysburg National Military Park', 'Pine Creek Gorge', 'Watkins Glen State Park']));
    expect(matchedNames).not.toContain('Unreviewed Third Region Candidate');
    expect((await listHighlights()).map((highlight) => highlight.name)).not.toContain('Unreviewed Third Region Candidate');
  });
});

async function importRestonNiagaraCandidates() {
  const normalized = normalizeSourcePoiRecords(
    restonNiagaraSource.records,
    { sourceSystem: restonNiagaraSource.sourceSystem, sourceDatabase: restonNiagaraSource.sourceDatabase }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);
}

async function importUnpromotedCandidate() {
  const normalized = normalizeSourcePoiRecords(
    [
      {
        sourceRecordId: 'reston-niagara-unpromoted-candidate',
        name: 'Unreviewed Third Region Candidate',
        latitude: 40.5,
        longitude: -77.8,
        sourceCategory: 'landmark'
      }
    ],
    { sourceSystem: 'tb19-supplemental', sourceDatabase: 'unreviewed-test' }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);
}

async function promotedRestonNiagaraCount() {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS total_count
      FROM highlights
      WHERE candidate_highlight_id LIKE 'tb19-supplemental-reston-niagara-source-backed-review-%'
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
