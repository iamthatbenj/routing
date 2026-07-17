import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import restonNiagaraSource from '../../../data/candidate-highlights/reston-niagara-supplement.json';
import acadiaSource from '../../../data/candidate-highlights/acadia-nps-supplement.json';
import { createMigratedTestDatabase } from './test-db';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { findHighlightsByH3Cells, listHighlights } from './highlights';
import { routeCorridorCells } from '$lib/route-corridors';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Reston to Niagara supplemental Candidate Highlight set', () => {
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

  it('defines a bounded source-backed Candidate Highlight set without Food Highlights', () => {
    const normalized = normalizeRestonNiagaraSource();

    expect(normalized.skipped).toEqual([]);
    expect(normalized.ambiguous).toEqual([]);
    expect(normalized.candidates).toHaveLength(12);
    expect(normalized.candidates.every((candidate) => candidate.latitude >= 38.5 && candidate.latitude <= 43.4)).toBe(true);
    expect(normalized.candidates.every((candidate) => candidate.longitude >= -80.9 && candidate.longitude <= -76.0)).toBe(true);
    expect(normalized.candidates.map((candidate) => candidate.proposedCategory)).toEqual(
      expect.arrayContaining(['nature', 'landmark', 'scenic_segment'])
    );
    expect(normalized.candidates.map((candidate) => candidate.proposedCategory)).not.toContain('food');
    expect(normalized.candidates.map((candidate) => candidate.name)).toEqual(
      expect.arrayContaining([
        'Harpers Ferry National Historical Park',
        'Gettysburg National Military Park',
        'Pine Creek Gorge',
        'Watkins Glen State Park',
        'Niagara Falls State Park'
      ])
    );
  });

  it('imports Reston to Niagara Candidate Highlights idempotently with provenance-ready evidence', async () => {
    const normalized = normalizeRestonNiagaraSource();

    const first = await importCandidateHighlights(db, normalized.candidates, normalized);
    const second = await importCandidateHighlights(db, normalized.candidates, normalized);

    expect(first.created).toBe(12);
    expect(first.updated).toBe(0);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(12);
    expect(await candidateCount(restonNiagaraSource.sourceSystem, restonNiagaraSource.sourceDatabase)).toBe(12);

    const gettysburg = await candidateRow('reston-niagara-gettysburg-nmp');
    expect(gettysburg).toMatchObject({
      name: 'Gettysburg National Military Park',
      proposed_category: 'landmark',
      source_system: restonNiagaraSource.sourceSystem,
      source_database: restonNiagaraSource.sourceDatabase,
      source_record_id: 'reston-niagara-gettysburg-nmp',
      status: 'imported'
    });
    expect(JSON.parse(String(gettysburg.evidence_json))).toMatchObject({
      sourceAuthority: 'National Park Service',
      tb19Bounds: 'inside Reston to Niagara corridor bounds'
    });
  });

  it('keeps raw third-region Candidate Highlights inert until promotion', async () => {
    const normalized = normalizeRestonNiagaraSource();
    await importCandidateHighlights(db, normalized.candidates, normalized);

    const routeUsableHighlights = await listHighlights();
    const routeCells = routeCorridorCells({
      type: 'LineString',
      coordinates: [
        [-77.3411, 38.96872],
        [-77.2311, 39.83093],
        [-79.05671, 43.0945]
      ]
    });
    const scoredHighlights = await findHighlightsByH3Cells(routeCells, 5);

    expect(routeUsableHighlights.map((highlight) => highlight.name)).not.toContain('Gettysburg National Military Park');
    expect(scoredHighlights.map((highlight) => highlight.name)).not.toContain('Gettysburg National Military Park');
    expect(await candidateCount(restonNiagaraSource.sourceSystem, restonNiagaraSource.sourceDatabase)).toBe(12);
  });

  it('remains compatible with the existing Acadia supplemental Candidate Highlight import', async () => {
    const restonNiagara = normalizeRestonNiagaraSource();
    const acadia = normalizeSourcePoiRecords(
      acadiaSource.records,
      { sourceSystem: acadiaSource.sourceSystem, sourceDatabase: acadiaSource.sourceDatabase }
    );

    await importCandidateHighlights(db, restonNiagara.candidates, restonNiagara);
    await importCandidateHighlights(db, acadia.candidates, acadia);

    expect(await candidateCount(restonNiagaraSource.sourceSystem, restonNiagaraSource.sourceDatabase)).toBe(12);
    expect(await candidateCount(acadiaSource.sourceSystem, acadiaSource.sourceDatabase)).toBe(10);
  });
});

function normalizeRestonNiagaraSource() {
  return normalizeSourcePoiRecords(
    restonNiagaraSource.records,
    { sourceSystem: restonNiagaraSource.sourceSystem, sourceDatabase: restonNiagaraSource.sourceDatabase }
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

async function candidateRow(sourceRecordId: string) {
  const result = await db.execute({
    sql: `
      SELECT name, proposed_category, latitude, longitude, source_system, source_database,
        source_record_id, evidence_json, status
      FROM candidate_highlights
      WHERE source_record_id = ?
      LIMIT 1
    `,
    args: [sourceRecordId]
  });

  const row = result.rows[0];
  if (!row) throw new Error(`Missing Candidate Highlight: ${sourceRecordId}`);
  return row;
}
