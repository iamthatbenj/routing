import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import acadiaSource from '../../../data/candidate-highlights/acadia-nps-supplement.json';
import acadiaPromotions from '../../../data/highlight-promotions/acadia-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importSecondRegionRoutingPlaces } from './routing-place-importer';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
import { createTrip } from './trips';
import { addTripStop, deriveLegs, listTripStops, type Leg } from './trip-stops';
import { findRoutingPlaceBySearchLabel } from './routing-places';
import { listRouteSearchesForTrip, startRouteSearch, type RouteSearch } from './route-searches';
import { saveRouteOption } from './saved-routes';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('two-region Route Search regressions', () => {
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

  it('persists locally relevant Route Options for Denver to Moab and Boston to Bar Harbor without cross-region Anchors', async () => {
    await seedSecondRegionData();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => providerResponseFor(JSON.parse(String(init?.body ?? '{}'))));
    vi.stubGlobal('fetch', fetchMock);

    const denverSearch = await routeSearchFor('Denver, Colorado', 'Moab, Utah');
    const bostonSearch = await routeSearchFor('Boston, Massachusetts', 'Bar Harbor, Maine');

    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(optionNames(denverSearch).join(' ')).toContain('Rocky Mountain National Park');
    expect(optionNames(denverSearch).join(' ')).not.toContain('Acadia');
    expect(optionNames(bostonSearch).join(' ')).toContain('Acadia National Park');
    expect(optionNames(bostonSearch).join(' ')).not.toContain('Colorado');
    expect(optionNames(bostonSearch).join(' ')).not.toContain('Dinosaur');

    assertPersistedSearchShape(denverSearch);
    assertPersistedSearchShape(bostonSearch);
    expect(denverSearch.options.some((option) => option.reasons.some((reason) => reason.kind === 'highlight' && reason.label === 'Rocky Mountain National Park'))).toBe(true);
    expect(bostonSearch.options.some((option) => option.reasons.some((reason) => reason.kind === 'highlight' && reason.label === 'Acadia National Park'))).toBe(true);
    expect(bostonSearch.options.some((option) => option.reasons.some((reason) => reason.kind === 'highlight' && reason.label === 'Park Loop Road' && reason.category === 'scenic_segment'))).toBe(true);
  });

  it('uses fallback Corridors on provider failure and prevents fallback Route Options from being saved for Leg Handoff', async () => {
    await seedSecondRegionData();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota exhausted', { status: 429 })));
    const { tripId, leg } = await tripLegFor('Boston, Massachusetts', 'Bar Harbor, Maine');

    await startRouteSearch({ leg, directness: 'Balanced' });
    const [routeSearch] = await listRouteSearchesForTrip(tripId);

    expect(routeSearch.status).toBe('complete');
    expect(routeSearch.diagnostics).toMatchObject({
      outcome: 'fallback_complete',
      routeSources: ['fallback-direct', 'fallback-anchor'],
      usedFallback: true,
      errorCategory: 'quota',
      errorStatus: 429
    });
    expect(routeSearch.options.every((option) => option.source.startsWith('fallback-'))).toBe(true);
    await expect(
      saveRouteOption({ tripId, leg, routeSearch, routeOptionId: routeSearch.options[0].id })
    ).rejects.toThrow('Approximate fallback Corridors cannot be saved for Leg Handoff.');
  });
});

async function seedSecondRegionData() {
  await importSecondRegionRoutingPlaces(db);
  const normalized = normalizeSourcePoiRecords(
    acadiaSource.records,
    { sourceSystem: acadiaSource.sourceSystem, sourceDatabase: acadiaSource.sourceDatabase }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);
  for (const promotion of acadiaPromotions) {
    await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
  }
}

async function routeSearchFor(fromLabel: string, toLabel: string) {
  const { tripId, leg } = await tripLegFor(fromLabel, toLabel);
  await startRouteSearch({ leg, directness: 'Balanced' });
  const [routeSearch] = await listRouteSearchesForTrip(tripId);
  return routeSearch;
}

async function tripLegFor(fromLabel: string, toLabel: string): Promise<{ tripId: string; leg: Leg }> {
  const tripAccess = await createTrip(`${fromLabel} to ${toLabel}`);
  await addTripStop(tripAccess.id, (await requiredRoutingPlace(fromLabel)).id);
  await addTripStop(tripAccess.id, (await requiredRoutingPlace(toLabel)).id);
  const [leg] = deriveLegs(await listTripStops(tripAccess.id));
  return { tripId: tripAccess.id, leg };
}

async function requiredRoutingPlace(searchLabel: string) {
  const place = await findRoutingPlaceBySearchLabel(searchLabel);
  if (!place) throw new Error(`Missing Routing Place: ${searchLabel}`);
  return place;
}

function providerResponseFor(body: { coordinates: [number, number][] }) {
  const label = routeLabelForCoordinates(body.coordinates);
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: geometryFor(label, body.coordinates) },
          properties: { summary: { duration: durationFor(label), distance: distanceFor(label) } }
        }
      ]
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function routeLabelForCoordinates(coordinates: [number, number][]) {
  if (coordinates.length !== 3) return 'direct';
  const [longitude, latitude] = coordinates[1];
  if (near(latitude, 40.3428) && near(longitude, -105.6836)) return 'Rocky Mountain National Park';
  if (near(latitude, 38.5543) && near(longitude, -107.6866)) return 'Black Canyon of the Gunnison';
  if (near(latitude, 39.1008) && near(longitude, -108.7335)) return 'Colorado National Monument';
  if (near(latitude, 44.3386) && near(longitude, -68.2733)) return 'Acadia National Park';
  if (near(latitude, 44.3512) && near(longitude, -68.2258)) return 'Cadillac Mountain';
  if (near(latitude, 44.329) && near(longitude, -68.205)) return 'Park Loop Road';
  return 'unknown';
}

function geometryFor(label: string, coordinates: [number, number][]) {
  if (label === 'direct') return coordinates;
  return coordinates;
}

function durationFor(label: string) {
  const durations: Record<string, number> = {
    direct: 17_000,
    'Rocky Mountain National Park': 19_300,
    'Black Canyon of the Gunnison': 18_900,
    'Colorado National Monument': 18_200,
    'Acadia National Park': 18_500,
    'Cadillac Mountain': 19_100,
    'Park Loop Road': 19_700
  };
  return durations[label] ?? 20_000;
}

function distanceFor(label: string) {
  const distances: Record<string, number> = {
    direct: 455_000,
    'Rocky Mountain National Park': 535_000,
    'Black Canyon of the Gunnison': 510_000,
    'Colorado National Monument': 490_000,
    'Acadia National Park': 470_000,
    'Cadillac Mountain': 482_000,
    'Park Loop Road': 489_000
  };
  return distances[label] ?? 500_000;
}

function assertPersistedSearchShape(routeSearch: RouteSearch) {
  expect(routeSearch.status).toBe('complete');
  expect(routeSearch.diagnostics).toMatchObject({
    provider: 'ors',
    outcome: 'complete',
    routeSources: ['ors-fastest', 'ors-anchor'],
    usedFallback: false
  });
  expect(routeSearch.options.map((option) => option.source)).toEqual(expect.arrayContaining(['ors-fastest', 'ors-anchor']));
  expect(routeSearch.options.length).toBeGreaterThanOrEqual(2);
  for (const option of routeSearch.options) {
    expect(option.durationSeconds).toBeGreaterThan(0);
    expect(option.distanceMeters).toBeGreaterThan(0);
    expect(option.geometryJson).toContain('LineString');
    expect(option.reasons.some((reason) => reason.kind === 'tradeoff')).toBe(true);
    expect(option.explanations.length).toBeGreaterThan(0);
    expect(option.interestScore).toBeGreaterThanOrEqual(0);
  }
}

function optionNames(routeSearch: RouteSearch) {
  return routeSearch.options.map((option) => option.name);
}

function near(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}
