import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import acadiaSource from '../../../data/candidate-highlights/acadia-nps-supplement.json';
import acadiaPromotions from '../../../data/highlight-promotions/acadia-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importSecondRegionRoutingPlaces } from './routing-place-importer';
import { createTrip } from './trips';
import { addTripStop, deriveLegs, listTripStops } from './trip-stops';
import { findRoutingPlaceBySearchLabel } from './routing-places';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { h3CellsForHighlight, promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
import { listRouteSearchesForTrip, startRouteSearch } from './route-searches';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Boston to Bar Harbor Route Option generation', () => {
  beforeEach(async () => {
    const testDb = await createMigratedTestDatabase();
    db = testDb.db;
    cleanup = testDb.cleanup;
    vi.stubEnv('ORS_API_KEY', 'test-ors-key');
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requests and persists a fastest baseline plus regional Anchor Route Options without live provider calls', async () => {
    await importSecondRegionRoutingPlaces(db);
    await importAndPromoteAcadiaHighlights();
    await insertBarHarborEndpointContextHighlight();
    const tripAccess = await createTrip('Boston to Bar Harbor Route Option test');
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Boston, Massachusetts')).id);
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Bar Harbor, Maine')).id);
    const [leg] = deriveLegs(await listTripStops(tripAccess.id));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { coordinates: [number, number][] };
      const viaName = anchorNameForCoordinates(body.coordinates);
      const geometryCoordinates = viaName
        ? body.coordinates
        : [body.coordinates[0], [-68.205, 44.329], body.coordinates[1]];
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: geometryCoordinates },
              properties: {
                summary: {
                  duration: viaName ? durationForAnchor(viaName) : 17_000,
                  distance: viaName ? distanceForAnchor(viaName) : 455_000
                }
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await startRouteSearch({ leg, directness: 'Direct' });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const requestBodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as { coordinates: [number, number][] });
    expect(requestBodies[0].coordinates).toEqual([
      [-71.05977, 42.35843],
      [-68.2039, 44.38758]
    ]);
    expect(requestBodies.slice(1).map((body) => anchorNameForCoordinates(body.coordinates))).toEqual([
      'Acadia National Park',
      'Cadillac Mountain',
      'Jordan Pond'
    ]);

    const [routeSearch] = await listRouteSearchesForTrip(tripAccess.id);
    expect(routeSearch.status).toBe('complete');
    expect(routeSearch.diagnostics).toMatchObject({
      provider: 'ors',
      outcome: 'complete',
      routeSources: ['ors-fastest', 'ors-anchor'],
      usedFallback: false
    });
    expect(routeSearch.options.map((option) => option.source)).toEqual(expect.arrayContaining(['ors-fastest', 'ors-anchor']));
    expect(routeSearch.options[0]).toMatchObject({
      name: 'Fastest baseline',
      source: 'ors-fastest',
      durationSeconds: 17_000,
      distanceMeters: 455_000
    });
    expect(routeSearch.options.some((option) => option.name === 'Via Acadia National Park')).toBe(true);
    expect(routeSearch.options.every((option) => option.geometryJson.includes('LineString'))).toBe(true);

    const acadiaOption = routeSearch.options.find((option) => option.name === 'Via Acadia National Park');
    expect(acadiaOption?.reasons).toEqual(expect.arrayContaining([{ kind: 'anchor', label: 'Acadia National Park' }]));

    const constrainedOption = routeSearch.options.find((option) => option.directnessConstraint.status === 'constrained');
    expect(constrainedOption?.directnessConstraint).toMatchObject({
      status: 'constrained',
      directness: 'Direct'
    });
    expect(constrainedOption?.directnessConstraint.reason).toContain('compare with caution');
    expect(constrainedOption?.explanations).toEqual(expect.arrayContaining([expect.stringContaining('Constrained Route Option')]));

    const scenicOption = routeSearch.options.find((option) =>
      option.reasons.some((reason) => reason.kind === 'highlight' && reason.label === 'Park Loop Road')
    );
    expect(scenicOption?.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'highlight', label: 'Park Loop Road', category: 'scenic_segment' }),
        expect.objectContaining({ kind: 'tradeoff', directness: 'Direct' }),
        { kind: 'endpoint_context', labels: ['Bar Harbor Shoreline Context'] }
      ])
    );
    expect(scenicOption?.explanations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Scenic Segment: Park Loop Road'),
        'Endpoint context, not scored: Bar Harbor Shoreline Context.'
      ])
    );
    expect(scenicOption?.reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'highlight', label: 'Bar Harbor Shoreline Context' })
      ])
    );

    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    const editData = await editPage.load({
      params: { token: tripAccess.editToken },
      url: new URL(`https://routing.test/trips/edit/${tripAccess.editToken}`)
    } as Parameters<typeof editPage.load>[0]);
    const mappedHighlightNames = editData.highlights.map((highlight) => highlight.name);
    expect(mappedHighlightNames).toEqual(expect.arrayContaining(['Acadia National Park', 'Park Loop Road', 'Bar Harbor Shoreline Context']));
    expect(mappedHighlightNames).not.toContain('Colorado National Monument');
  });
});

async function importAndPromoteAcadiaHighlights() {
  const normalized = normalizeSourcePoiRecords(
    acadiaSource.records,
    { sourceSystem: acadiaSource.sourceSystem, sourceDatabase: acadiaSource.sourceDatabase }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);

  for (const promotion of acadiaPromotions) {
    await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
  }
}

async function insertBarHarborEndpointContextHighlight() {
  const barHarbor = await requiredRoutingPlace('Bar Harbor, Maine');
  await db.execute({
    sql: `
      INSERT INTO highlights (id, name, category, latitude, longitude, strength, visit_effort, endpoint_context_place_id, description)
      VALUES ('bar-harbor-shoreline-context', 'Bar Harbor Shoreline Context', 'landmark', 44.38758, -68.2039, 99, 'Quick Stop', ?, 'Endpoint context used to explain Bar Harbor without scoring it as on-route interest.')
    `,
    args: [barHarbor.id]
  });

  for (const cell of h3CellsForHighlight(44.38758, -68.2039, 5)) {
    await db.execute({
      sql: 'INSERT INTO highlight_h3_cells (highlight_id, resolution, cell) VALUES (?, 5, ?)',
      args: ['bar-harbor-shoreline-context', cell]
    });
  }
}

async function requiredRoutingPlace(searchLabel: string) {
  const place = await findRoutingPlaceBySearchLabel(searchLabel);
  if (!place) throw new Error(`Missing Routing Place: ${searchLabel}`);
  return place;
}

function anchorNameForCoordinates(coordinates: [number, number][]) {
  if (coordinates.length !== 3) return '';
  const [longitude, latitude] = coordinates[1];
  if (near(latitude, 44.3386) && near(longitude, -68.2733)) return 'Acadia National Park';
  if (near(latitude, 44.3512) && near(longitude, -68.2258)) return 'Cadillac Mountain';
  if (near(latitude, 44.3206) && near(longitude, -68.2539)) return 'Jordan Pond';
  if (near(latitude, 44.329) && near(longitude, -68.205)) return 'Park Loop Road';
  return `unknown anchor at ${latitude},${longitude}`;
}

function durationForAnchor(anchor: string) {
  return anchor === 'Acadia National Park' ? 19_000 : anchor === 'Cadillac Mountain' ? 19_100 : anchor === 'Jordan Pond' ? 19_400 : 19_700;
}

function distanceForAnchor(anchor: string) {
  return anchor === 'Acadia National Park' ? 470_000 : anchor === 'Cadillac Mountain' ? 482_000 : anchor === 'Jordan Pond' ? 486_000 : 489_000;
}

function near(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}
