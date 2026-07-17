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
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
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
    const tripAccess = await createTrip('Boston to Bar Harbor Route Option test');
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Boston, Massachusetts')).id);
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Bar Harbor, Maine')).id);
    const [leg] = deriveLegs(await listTripStops(tripAccess.id));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { coordinates: [number, number][] };
      const viaName = anchorNameForCoordinates(body.coordinates);
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: body.coordinates },
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

    await startRouteSearch({ leg, directness: 'Balanced' });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const requestBodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as { coordinates: [number, number][] });
    expect(requestBodies[0].coordinates).toEqual([
      [-71.05977, 42.35843],
      [-68.2039, 44.38758]
    ]);
    expect(requestBodies.slice(1).map((body) => anchorNameForCoordinates(body.coordinates))).toEqual([
      'Acadia National Park',
      'Cadillac Mountain',
      'Park Loop Road'
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
  if (near(latitude, 44.329) && near(longitude, -68.205)) return 'Park Loop Road';
  return `unknown anchor at ${latitude},${longitude}`;
}

function durationForAnchor(anchor: string) {
  return anchor === 'Acadia National Park' ? 18_500 : anchor === 'Cadillac Mountain' ? 19_100 : 19_700;
}

function distanceForAnchor(anchor: string) {
  return anchor === 'Acadia National Park' ? 470_000 : anchor === 'Cadillac Mountain' ? 482_000 : 489_000;
}

function near(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}
