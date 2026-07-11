import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { createMigratedTestDatabase } from './test-db';
import { findHighlightsByH3Cells, listHighlights } from './highlights';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

const source = {
  sourceSystem: 'turso-poi',
  sourceDatabase: 'regional-pois'
};

describe('Candidate Highlight importer', () => {
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

  it('normalizes source POI records as Candidate Highlights with provenance-ready evidence', () => {
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
      source
    );

    expect(normalized).toEqual({
      candidates: [
        expect.objectContaining({
          id: 'turso-poi-regional-pois-poi-acadia',
          name: 'Acadia National Park',
          proposedCategory: 'nature',
          sourceSystem: 'turso-poi',
          sourceDatabase: 'regional-pois',
          sourceRecordId: 'poi-acadia',
          sourceUrl: 'https://example.test/acadia',
          sourceCategory: 'national_park',
          evidence: expect.objectContaining({
            sourceRank: 0.98,
            importedName: 'Acadia National Park',
            importedCoordinates: { latitude: 44.3386, longitude: -68.2733 }
          })
        })
      ],
      skipped: [],
      ambiguous: []
    });
  });

  it('reports malformed, deferred Food Highlight, and duplicate source records without importing them', async () => {
    const normalized = normalizeSourcePoiRecords(
      [
        { sourceRecordId: 'missing-name', name: '', latitude: 44, longitude: -68, sourceCategory: 'park' },
        { sourceRecordId: 'bad-coordinates', name: 'Broken Point', latitude: Number.NaN, longitude: -68, sourceCategory: 'viewpoint' },
        { sourceRecordId: 'restaurant', name: 'Ordinary Restaurant', latitude: 44, longitude: -68, sourceCategory: 'restaurant' },
        { sourceRecordId: 'duplicate', name: 'Duplicate One', latitude: 44, longitude: -68, sourceCategory: 'park' },
        { sourceRecordId: 'duplicate', name: 'Duplicate Two', latitude: 44.1, longitude: -68.1, sourceCategory: 'park' }
      ],
      source
    );

    const summary = await importCandidateHighlights(db, normalized.candidates, normalized);

    expect(summary).toEqual({
      created: 0,
      updated: 0,
      skipped: [
        { sourceRecordId: 'missing-name', reason: 'missing name' },
        { sourceRecordId: 'bad-coordinates', reason: 'missing or invalid coordinates' },
        { sourceRecordId: 'restaurant', reason: 'Food Highlights are deferred from TB16' }
      ],
      ambiguous: [{ sourceRecordId: 'duplicate', reason: 'duplicate source identity in import batch' }]
    });
    expect(await candidateHighlightCount()).toBe(0);
  });

  it('imports Candidate Highlights idempotently and updates records by stable source identity', async () => {
    const first = normalizeSourcePoiRecords(
      [
        {
          sourceRecordId: 'poi-acadia',
          name: 'Acadia National Park',
          latitude: 44.3386,
          longitude: -68.2733,
          sourceCategory: 'park',
          evidence: { sourceRank: 0.98 }
        }
      ],
      source
    );
    const firstSummary = await importCandidateHighlights(db, first.candidates, first);

    const second = normalizeSourcePoiRecords(
      [
        {
          sourceRecordId: 'poi-acadia',
          name: 'Acadia National Park and Mount Desert Island',
          latitude: 44.35,
          longitude: -68.25,
          sourceCategory: 'park',
          evidence: { sourceRank: 1 }
        }
      ],
      source
    );
    const secondSummary = await importCandidateHighlights(db, second.candidates, second);

    expect(firstSummary.created).toBe(1);
    expect(firstSummary.updated).toBe(0);
    expect(secondSummary.created).toBe(0);
    expect(secondSummary.updated).toBe(1);
    expect(await candidateHighlightCount()).toBe(1);

    const row = await candidateHighlightRow('poi-acadia');
    expect(row).toMatchObject({
      name: 'Acadia National Park and Mount Desert Island',
      proposed_category: 'nature',
      source_system: 'turso-poi',
      source_database: 'regional-pois',
      source_record_id: 'poi-acadia',
      status: 'imported'
    });
    expect(Number(row.latitude)).toBe(44.35);
    expect(JSON.parse(String(row.evidence_json))).toMatchObject({ sourceRank: 1 });
  });

  it('keeps Candidate Highlights separate from route-usable Highlights and scoring lookup', async () => {
    const normalized = normalizeSourcePoiRecords(
      [
        {
          sourceRecordId: 'poi-camden-hills',
          name: 'Camden Hills State Park',
          latitude: 44.229,
          longitude: -69.049,
          sourceCategory: 'park'
        }
      ],
      source
    );
    await importCandidateHighlights(db, normalized.candidates, normalized);

    const routeUsableHighlights = await listHighlights();
    const scoredHighlights = await findHighlightsByH3Cells(['852a3067fffffff'], 5);

    expect(routeUsableHighlights.map((highlight) => highlight.name)).not.toContain('Camden Hills State Park');
    expect(scoredHighlights.map((highlight) => highlight.name)).not.toContain('Camden Hills State Park');
    expect(await candidateHighlightCount()).toBe(1);
  });
});

async function candidateHighlightCount() {
  const result = await db.execute('SELECT COUNT(*) AS count FROM candidate_highlights');
  return Number(result.rows[0].count);
}

async function candidateHighlightRow(sourceRecordId: string) {
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
