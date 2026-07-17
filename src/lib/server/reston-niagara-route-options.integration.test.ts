import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import restonNiagaraSource from '../../../data/candidate-highlights/reston-niagara-supplement.json';
import restonNiagaraPromotions from '../../../data/highlight-promotions/reston-niagara-reviewed-highlights.json';
import { createMigratedTestDatabase } from './test-db';
import { importThirdRegionRoutingPlaces } from './routing-place-importer';
import { importCandidateHighlights, normalizeSourcePoiRecords } from './candidate-highlight-importer';
import { promoteCandidateHighlight, type PromotionReview } from './highlight-promotion';
import { createTrip } from './trips';
import { addTripStop, deriveLegs, listTripStops, type Leg } from './trip-stops';
import { findRoutingPlaceBySearchLabel } from './routing-places';
import { listRouteSearchesForTrip, startRouteSearch, type Directness, type RouteSearch } from './route-searches';
import { findSavedRoute, saveRouteOption } from './saved-routes';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('Reston to Niagara Falls Route Option generation', () => {
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

  it('generates provider-backed Route Options for all Directness choices without earlier-region Anchor contamination', async () => {
    await seedThirdRegionData();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => providerResponseFor(JSON.parse(String(init?.body ?? '{}'))));
    vi.stubGlobal('fetch', fetchMock);

    const searches: Record<Directness, RouteSearch> = {
      Direct: await routeSearchFor('Direct'),
      Balanced: await routeSearchFor('Balanced'),
      Adventurous: await routeSearchFor('Adventurous')
    };

    expect(fetchMock).toHaveBeenCalledTimes(12);
    const requestedAnchorNames = fetchMock.mock.calls
      .map(([, init]) => routeLabelForCoordinates((JSON.parse(String(init?.body ?? '{}')) as { coordinates: [number, number][] }).coordinates))
      .filter((label) => label !== 'direct');
    expect(requestedAnchorNames.length).toBe(9);
    expect(requestedAnchorNames.every((name) => THIRD_REGION_ROUTE_LABELS.has(name))).toBe(true);
    expect(requestedAnchorNames.join(' ')).not.toMatch(/Acadia|Colorado|Moab|Bar Harbor/);

    for (const directness of ['Direct', 'Balanced', 'Adventurous'] as const) {
      const routeSearch = searches[directness];
      expect(routeSearch.status).toBe('complete');
      expect(routeSearch.diagnostics).toMatchObject({
        provider: 'ors',
        outcome: 'complete',
        routeSources: ['ors-fastest', 'ors-anchor'],
        usedFallback: false
      });
      expect(routeSearch.options[0]).toMatchObject({ name: 'Fastest baseline', source: 'ors-fastest' });
      expect(routeSearch.options.every((option) => option.geometryJson.includes('LineString'))).toBe(true);
      expect(routeSearch.options.every((option) => option.directnessConstraint.directness === directness)).toBe(true);
      expect(routeSearch.options.every((option) => option.explanations.length > 0)).toBe(true);
      expect(routeSearch.options.some((option) => option.reasons.some((reason) => reason.kind === 'anchor'))).toBe(true);
      expect(routeSearch.options.map((option) => option.name).join(' ')).not.toMatch(/Acadia|Colorado National Monument|Rocky Mountain/);
    }

  });

  it('preserves third-region score, reasons, Directness context, and relevant map Highlights through save, share, and Leg Handoff', async () => {
    await seedThirdRegionData();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => providerResponseFor(JSON.parse(String(init?.body ?? '{}')))));
    const tripAccess = await createTrip('Reston to Niagara preserved route context test');
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Reston, Virginia')).id);
    await addTripStop(tripAccess.id, (await requiredRoutingPlace('Niagara Falls, New York')).id);
    const [leg] = deriveLegs(await listTripStops(tripAccess.id));

    await startRouteSearch({ leg, directness: 'Balanced' });
    const [routeSearch] = await listRouteSearchesForTrip(tripAccess.id);
    const interestingOption = routeSearch.options.find((option) => option.source === 'ors-anchor');
    expect(interestingOption?.reasons.some((reason) => reason.kind === 'anchor')).toBe(true);
    expect(interestingOption?.reasons.some((reason) => reason.kind === 'highlight')).toBe(true);
    expect(typeof interestingOption?.interestScore).toBe('number');
    expect(interestingOption?.directnessConstraint).toMatchObject({ directness: 'Balanced' });

    const savedRouteId = await saveRouteOption({ tripId: tripAccess.id, leg, routeSearch, routeOptionId: interestingOption?.id ?? '' });
    const savedRoute = await findSavedRoute(tripAccess.id, savedRouteId);
    expect(savedRoute?.snapshot).toMatchObject({
      routeOptionId: interestingOption?.id,
      interestScore: interestingOption?.interestScore,
      directness: 'Balanced',
      directnessConstraint: interestingOption?.directnessConstraint
    });
    expect(savedRoute?.snapshot.reasons.some((reason) => reason.kind === 'anchor')).toBe(true);
    expect(savedRoute?.snapshot.reasons.some((reason) => reason.kind === 'highlight')).toBe(true);

    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    const editData = await editPage.load({
      params: { token: tripAccess.editToken },
      url: new URL(`https://routing.test/trips/edit/${tripAccess.editToken}`)
    } as Parameters<typeof editPage.load>[0]);
    const editHighlightNames = editData.highlights.map((highlight) => highlight.name);
    expect(editHighlightNames).toEqual(expect.arrayContaining(highlightReasonNames(savedRoute?.snapshot.reasons ?? [])));
    expect(editHighlightNames.join(' ')).not.toMatch(/Acadia|Colorado National Monument/);

    const sharePage = await import('../../routes/trips/share/[token]/+page.server');
    const shareData = await sharePage.load({ params: { token: tripAccess.shareToken } } as Parameters<typeof sharePage.load>[0]);
    const sharedPreferredRoute = shareData.legs[0].preferredSavedRoute;
    expect(sharedPreferredRoute?.snapshot).toMatchObject({
      interestScore: savedRoute?.snapshot.interestScore,
      directnessConstraint: savedRoute?.snapshot.directnessConstraint
    });
    expect(sharedPreferredRoute?.snapshot.reasons).toEqual(savedRoute?.snapshot.reasons);
    expect(shareData.highlights.map((highlight) => highlight.name)).toEqual(expect.arrayContaining(highlightReasonNames(savedRoute?.snapshot.reasons ?? [])));
    expect(shareData.highlights.map((highlight) => highlight.name).join(' ')).not.toMatch(/Acadia|Colorado National Monument/);

    const handoffPage = await import('../../routes/trips/edit/[token]/handoff/[savedRouteId]/+page.server');
    const handoffData = await handoffPage.load({
      params: { token: tripAccess.editToken, savedRouteId },
      url: new URL(`https://routing.test/trips/edit/${tripAccess.editToken}/handoff/${savedRouteId}`)
    } as Parameters<typeof handoffPage.load>[0]);
    expect(handoffData.savedRoute.snapshot).toMatchObject({
      interestScore: savedRoute?.snapshot.interestScore,
      directnessConstraint: savedRoute?.snapshot.directnessConstraint,
      endpoints: { from: 'Reston, Virginia', to: 'Niagara Falls, New York' }
    });
    expect(handoffData.geometryWarning).toContain('Shaping Stops');
  });

  it('uses fallback Corridors with Directness assessment and keeps them unsaveable for Leg Handoff', async () => {
    await seedThirdRegionData();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('provider quota exhausted', { status: 429 })));
    const { tripId, leg } = await restonNiagaraLeg();

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
    expect(routeSearch.options[0]).toMatchObject({ source: 'fallback-direct' });
    expect(routeSearch.options.every((option) => option.source.startsWith('fallback-'))).toBe(true);
    expect(routeSearch.options.every((option) => option.directnessConstraint.directness === 'Balanced')).toBe(true);
    expect(routeSearch.options.map((option) => option.name).join(' ')).not.toMatch(/Acadia|Colorado National Monument/);
    await expect(
      saveRouteOption({ tripId, leg, routeSearch, routeOptionId: routeSearch.options[0].id })
    ).rejects.toThrow('Approximate fallback Corridors cannot be saved for Leg Handoff.');
  });
});

async function seedThirdRegionData() {
  await importThirdRegionRoutingPlaces(db);
  const normalized = normalizeSourcePoiRecords(
    restonNiagaraSource.records,
    { sourceSystem: restonNiagaraSource.sourceSystem, sourceDatabase: restonNiagaraSource.sourceDatabase }
  );
  await importCandidateHighlights(db, normalized.candidates, normalized);
  for (const promotion of restonNiagaraPromotions) {
    await promoteCandidateHighlight(db, promotion.candidateHighlightId, promotion.review as PromotionReview);
  }
}

async function routeSearchFor(directness: Directness) {
  const { tripId, leg } = await restonNiagaraLeg();
  await startRouteSearch({ leg, directness });
  const [routeSearch] = await listRouteSearchesForTrip(tripId);
  return routeSearch;
}

async function restonNiagaraLeg(): Promise<{ tripId: string; leg: Leg }> {
  const tripAccess = await createTrip('Reston to Niagara Falls Route Option test');
  await addTripStop(tripAccess.id, (await requiredRoutingPlace('Reston, Virginia')).id);
  await addTripStop(tripAccess.id, (await requiredRoutingPlace('Niagara Falls, New York')).id);
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

const THIRD_REGION_COORDINATES: Record<string, [number, number]> = {
  'Chesapeake and Ohio Canal at Great Falls': [-77.255, 38.994],
  'Harpers Ferry National Historical Park': [-77.73888, 39.32538],
  'Gettysburg National Military Park': [-77.2311, 39.83093],
  'Flight 93 National Memorial': [-78.9053, 40.0556],
  'Allegheny Portage Railroad National Historic Site': [-78.549, 40.459],
  'Johnstown Flood National Memorial': [-78.7714, 40.3459],
  'Pine Creek Gorge': [-77.4558, 41.7001],
  'Kinzua Bridge State Park': [-78.5865, 41.7592],
  'Watkins Glen State Park': [-76.8795, 42.3736],
  'Letchworth State Park': [-78.0431, 42.5845],
  'Finger Lakes Scenic Route': [-76.9, 42.45],
  'Niagara Falls State Park': [-79.0642, 43.0838],
  Leesburg: [-77.5636, 39.11566],
  Winchester: [-78.16333, 39.18566],
  'Harpers Ferry': [-77.73888, 39.32538],
  Martinsburg: [-77.96389, 39.45621],
  Frederick: [-77.41054, 39.41427],
  Hagerstown: [-77.71999, 39.64176],
  Gettysburg: [-77.2311, 39.83093],
  Harrisburg: [-76.88442, 40.2737],
  Altoona: [-78.39474, 40.51868],
  Johnstown: [-78.92197, 40.32674],
  'State College': [-77.86, 40.7934],
  Williamsport: [-77.00108, 41.24119],
  Lewisburg: [-76.88441, 40.96453],
  Buffalo: [-78.87837, 42.88645],
  Rochester: [-77.61556, 43.15478],
  Ithaca: [-76.49661, 42.44063],
  Corning: [-77.05469, 42.14285],
  Elmira: [-76.80773, 42.0898],
  'Watkins Glen': [-76.87329, 42.38063]
};

const THIRD_REGION_ROUTE_LABELS = new Set(Object.keys(THIRD_REGION_COORDINATES));

function routeLabelForCoordinates(coordinates: [number, number][]) {
  if (coordinates.length !== 3) return 'direct';
  const [longitude, latitude] = coordinates[1];
  for (const [label, [expectedLongitude, expectedLatitude]] of Object.entries(THIRD_REGION_COORDINATES)) {
    if (near(latitude, expectedLatitude) && near(longitude, expectedLongitude)) return label;
  }
  return `unknown anchor at ${latitude},${longitude}`;
}

function geometryFor(label: string, coordinates: [number, number][]) {
  if (label === 'direct') {
    return [coordinates[0], [-77.2311, 39.83093], [-77.4558, 41.7001], coordinates[1]];
  }
  return coordinates;
}

function durationFor(label: string) {
  const durations: Record<string, number> = {
    direct: 25_000,
    'Chesapeake and Ohio Canal at Great Falls': 26_600,
    'Harpers Ferry National Historical Park': 27_000,
    'Gettysburg National Military Park': 28_000,
    'Flight 93 National Memorial': 31_000,
    'Allegheny Portage Railroad National Historic Site': 30_500,
    'Johnstown Flood National Memorial': 31_200,
    'Pine Creek Gorge': 31_800,
    'Kinzua Bridge State Park': 33_600,
    'Watkins Glen State Park': 32_200,
    'Letchworth State Park': 31_400,
    'Finger Lakes Scenic Route': 32_800,
    'Niagara Falls State Park': 25_900
  };
  return durations[label] ?? 29_500;
}

function distanceFor(label: string) {
  const distances: Record<string, number> = {
    direct: 640_000,
    'Chesapeake and Ohio Canal at Great Falls': 655_000,
    'Harpers Ferry National Historical Park': 675_000,
    'Gettysburg National Military Park': 705_000,
    'Flight 93 National Memorial': 760_000,
    'Allegheny Portage Railroad National Historic Site': 748_000,
    'Johnstown Flood National Memorial': 772_000,
    'Pine Creek Gorge': 790_000,
    'Kinzua Bridge State Park': 830_000,
    'Watkins Glen State Park': 805_000,
    'Letchworth State Park': 780_000,
    'Finger Lakes Scenic Route': 815_000,
    'Niagara Falls State Park': 645_000
  };
  return distances[label] ?? 710_000;
}

function highlightReasonNames(reasons: RouteSearch['options'][number]['reasons']) {
  return reasons
    .filter((reason) => reason.kind === 'highlight')
    .map((reason) => reason.label);
}

function near(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}
