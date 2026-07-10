import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@libsql/client';
import { createMigratedTestDatabase } from './test-db';

let db: Client;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./db', () => ({
  get db() {
    return db;
  }
}));

describe('persisted Trip planning lifecycle integration', () => {
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

  it('keeps Route Searches and Preferred Saved Routes attached only to matching current Legs after reordering', async () => {
    const { tripAccess, stops } = await createTripWithStops([
      'Denver, Colorado',
      'Moab, Utah',
      'Rocky Mountain National Park, Colorado'
    ]);
    await insertRouteSearchWithPreferredSavedRoute({
      tripId: tripAccess.id,
      fromStopId: stops.denver.id,
      toStopId: stops.moab.id,
      suffix: 'denver-moab'
    });
    await insertRouteSearchWithPreferredSavedRoute({
      tripId: tripAccess.id,
      fromStopId: stops.moab.id,
      toStopId: stops.rocky.id,
      suffix: 'moab-rocky'
    });

    const initialEdit = await loadEditTrip(tripAccess.editToken);
    expect(legSummaries(initialEdit)).toEqual([
      'Denver->Moab search=search-denver-moab saved=Denver to Moab scenic Corridor preferred=Denver to Moab scenic Corridor',
      'Moab->Rocky Mountain National Park search=search-moab-rocky saved=Moab to Rocky Mountain National Park scenic Corridor preferred=Moab to Rocky Mountain National Park scenic Corridor'
    ]);

    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    await callAction(editPage.actions.moveStop, tripAccess.editToken, {
      stopId: stops.denver.id,
      direction: 'down'
    });

    const reorderedEdit = await loadEditTrip(tripAccess.editToken);
    const reorderedShare = await loadSharedTrip(tripAccess.shareToken);

    expect(legSummaries(reorderedEdit)).toEqual([
      'Moab->Denver search=none saved=none preferred=none',
      'Denver->Rocky Mountain National Park search=none saved=none preferred=none'
    ]);
    expect(shareSummaries(reorderedShare)).toEqual([
      'Moab->Denver preferred=none',
      'Denver->Rocky Mountain National Park preferred=none'
    ]);
  });

  it('does not show stale Saved Routes after deleting the middle Trip Stop creates a new current Leg', async () => {
    const { tripAccess, stops } = await createTripWithStops([
      'Denver, Colorado',
      'Moab, Utah',
      'Rocky Mountain National Park, Colorado'
    ]);
    await insertRouteSearchWithPreferredSavedRoute({
      tripId: tripAccess.id,
      fromStopId: stops.denver.id,
      toStopId: stops.moab.id,
      suffix: 'denver-moab'
    });
    await insertRouteSearchWithPreferredSavedRoute({
      tripId: tripAccess.id,
      fromStopId: stops.moab.id,
      toStopId: stops.rocky.id,
      suffix: 'moab-rocky'
    });

    const editPage = await import('../../routes/trips/edit/[token]/+page.server');
    await callAction(editPage.actions.deleteStop, tripAccess.editToken, { stopId: stops.moab.id });

    const editData = await loadEditTrip(tripAccess.editToken);
    const shareData = await loadSharedTrip(tripAccess.shareToken);

    expect(editData.stops.map((stop) => stop.routingPlace.name)).toEqual(['Denver', 'Rocky Mountain National Park']);
    expect(legSummaries(editData)).toEqual([
      'Denver->Rocky Mountain National Park search=none saved=none preferred=none'
    ]);
    expect(shareSummaries(shareData)).toEqual([
      'Denver->Rocky Mountain National Park preferred=none'
    ]);
  });
});

async function createTripWithStops(labels: string[]) {
  const { createTrip } = await import('./trips');
  const editPage = await import('../../routes/trips/edit/[token]/+page.server');
  const tripAccess = await createTrip('Lifecycle Trip');

  for (const label of labels) {
    await callAction(editPage.actions.addStop, tripAccess.editToken, {
      routingPlace: label,
      details: ''
    });
  }

  const editData = await loadEditTrip(tripAccess.editToken);
  return {
    tripAccess,
    stops: {
      denver: stopByName(editData.stops, 'Denver'),
      moab: stopByName(editData.stops, 'Moab'),
      rocky: stopByName(editData.stops, 'Rocky Mountain National Park')
    }
  };
}

async function callAction(action: Function, token: string, fields: Record<string, string>) {
  const request = new Request('https://routing.test', {
    method: 'POST',
    body: new URLSearchParams(fields)
  });
  return action({ request, params: { token } });
}

async function loadEditTrip(token: string) {
  const editPage = await import('../../routes/trips/edit/[token]/+page.server');
  return editPage.load({
    params: { token },
    url: new URL(`https://routing.test/trips/edit/${token}`)
  } as Parameters<typeof editPage.load>[0]);
}

async function loadSharedTrip(token: string) {
  const sharePage = await import('../../routes/trips/share/[token]/+page.server');
  return sharePage.load({ params: { token } } as Parameters<typeof sharePage.load>[0]);
}

function stopByName(stops: Awaited<ReturnType<typeof loadEditTrip>>['stops'], name: string) {
  const stop = stops.find((candidate) => candidate.routingPlace.name === name);
  if (!stop) throw new Error(`Missing Trip Stop: ${name}`);
  return stop;
}

async function insertRouteSearchWithPreferredSavedRoute({
  tripId,
  fromStopId,
  toStopId,
  suffix
}: {
  tripId: string;
  fromStopId: string;
  toStopId: string;
  suffix: string;
}) {
  const searchId = `search-${suffix}`;
  const optionId = `option-${suffix}`;
  const savedRouteId = `saved-${suffix}`;
  const now = new Date().toISOString();
  const title = titleForSuffix(suffix);

  await db.execute({
    sql: `
      INSERT INTO route_searches (id, trip_id, from_trip_stop_id, to_trip_stop_id, directness, status, provider, diagnostic_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Balanced', 'complete', 'fixture', ?, ?, ?)
    `,
    args: [
      searchId,
      tripId,
      fromStopId,
      toStopId,
      JSON.stringify({ provider: 'ors', outcome: 'complete', routeSources: ['ors-fastest'], optionCount: 1, usedFallback: false }),
      now,
      now
    ]
  });

  await db.execute({
    sql: `
      INSERT INTO route_options (id, route_search_id, name, source, duration_seconds, distance_meters, geometry_json, sort_order, interest_score, explanation_json, reason_json)
      VALUES (?, ?, ?, 'ors-fastest', 3600, 160934, ?, 1, 10, '[]', '[]')
    `,
    args: [optionId, searchId, title, JSON.stringify({ type: 'LineString', coordinates: [[-105, 39], [-104, 40]] })]
  });

  await db.execute({
    sql: `
      INSERT INTO saved_routes (id, trip_id, from_trip_stop_id, to_trip_stop_id, route_option_id, title, is_preferred, snapshot_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `,
    args: [savedRouteId, tripId, fromStopId, toStopId, optionId, title, JSON.stringify(savedRouteSnapshot(optionId, title)), now, now]
  });
}

function savedRouteSnapshot(routeOptionId: string, name: string) {
  return {
    routeOptionId,
    name,
    source: 'ors-fastest',
    endpoints: {
      from: 'From, Test',
      to: 'To, Test'
    },
    directness: 'Balanced',
    durationSeconds: 3600,
    distanceMeters: 160934,
    geometryJson: JSON.stringify({ type: 'LineString', coordinates: [[-105, 39], [-104, 40]] }),
    interestScore: 10,
    explanations: [],
    reasons: [],
    fastestBaselineDeltaSeconds: 0,
    warnings: [],
    handoffStops: []
  };
}

function legSummaries(data: Awaited<ReturnType<typeof loadEditTrip>>) {
  return data.legs.map((leg) => {
    const savedTitles = leg.savedRoutes.map((route) => route.title).join('|') || 'none';
    const preferredTitle = leg.savedRoutes.find((route) => route.isPreferred)?.title ?? 'none';
    return `${leg.from.routingPlace.name}->${leg.to.routingPlace.name} search=${leg.routeSearch?.id ?? 'none'} saved=${savedTitles} preferred=${preferredTitle}`;
  });
}

function shareSummaries(data: Awaited<ReturnType<typeof loadSharedTrip>>) {
  return data.legs.map(
    (leg) => `${leg.from.routingPlace.name}->${leg.to.routingPlace.name} preferred=${leg.preferredSavedRoute?.title ?? 'none'}`
  );
}

function titleForSuffix(suffix: string) {
  return suffix === 'denver-moab'
    ? 'Denver to Moab scenic Corridor'
    : 'Moab to Rocky Mountain National Park scenic Corridor';
}
