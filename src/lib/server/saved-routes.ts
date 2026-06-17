import { randomUUID } from 'node:crypto';
import type { RouteReason } from '$lib/route-reasons';
import { shapingStopsFromGeometry } from '$lib/shaping-stops';
import { db } from './db';
import type { RouteOption, RouteSearch } from './route-searches';
import type { Leg } from './trip-stops';

export type SavedRouteSnapshot = {
  routeOptionId: string;
  name: string;
  source: string;
  endpoints: {
    from: string;
    to: string;
  };
  directness: string;
  durationSeconds: number;
  distanceMeters: number;
  geometryJson: string;
  interestScore: number;
  explanations: string[];
  reasons: RouteReason[];
  fastestBaselineDeltaSeconds: number;
  warnings: string[];
  handoffStops: HandoffStop[];
};

export type HandoffStop = {
  label: string;
  displayLabel?: string;
  latitude?: number;
  longitude?: number;
  routeFraction?: number;
};

export type SavedRoute = {
  id: string;
  tripId: string;
  fromTripStopId: string;
  toTripStopId: string;
  routeOptionId: string | null;
  title: string;
  isPreferred: boolean;
  snapshot: SavedRouteSnapshot;
  createdAt: string;
  updatedAt: string;
};

function rowToSavedRoute(row: Record<string, unknown>): SavedRoute {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    fromTripStopId: String(row.from_trip_stop_id),
    toTripStopId: String(row.to_trip_stop_id),
    routeOptionId: row.route_option_id ? String(row.route_option_id) : null,
    title: String(row.title),
    isPreferred: Number(row.is_preferred) === 1,
    snapshot: parseSnapshot(String(row.snapshot_json)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function listSavedRoutesForTrip(tripId: string) {
  const result = await db.execute({
    sql: `
      SELECT id, trip_id, from_trip_stop_id, to_trip_stop_id, route_option_id, title,
        is_preferred, snapshot_json, created_at, updated_at
      FROM saved_routes
      WHERE trip_id = ?
      ORDER BY from_trip_stop_id, to_trip_stop_id, is_preferred DESC, created_at DESC
    `,
    args: [tripId]
  });

  return result.rows.map(rowToSavedRoute);
}

export async function saveRouteOption({
  tripId,
  leg,
  routeSearch,
  routeOptionId
}: {
  tripId: string;
  leg: Leg;
  routeSearch: RouteSearch;
  routeOptionId: string;
}) {
  const routeOption = routeSearch.options.find((option) => option.id === routeOptionId);

  if (!routeOption) {
    throw new Error('Route Option does not belong to this Leg Route Search.');
  }

  const existingCount = await countSavedRoutesForLeg(tripId, leg.from.id, leg.to.id);
  const isPreferred = existingCount === 0;
  const now = new Date().toISOString();
  const id = randomUUID();

  if (isPreferred) {
    await clearPreferredRoute(tripId, leg.from.id, leg.to.id);
  }

  await db.execute({
    sql: `
      INSERT INTO saved_routes (
        id, trip_id, from_trip_stop_id, to_trip_stop_id, route_option_id, title,
        is_preferred, snapshot_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      tripId,
      leg.from.id,
      leg.to.id,
      routeOption.id,
      routeOption.name,
      isPreferred ? 1 : 0,
      JSON.stringify(buildSnapshot(routeOption, routeSearch, leg)),
      now,
      now
    ]
  });

  await touchTrip(tripId);
  return id;
}

export async function markSavedRoutePreferred(tripId: string, savedRouteId: string) {
  const savedRoute = await findSavedRoute(tripId, savedRouteId);

  if (!savedRoute) {
    throw new Error('Saved Route does not belong to this Trip.');
  }

  await clearPreferredRoute(tripId, savedRoute.fromTripStopId, savedRoute.toTripStopId);
  await db.execute({
    sql: 'UPDATE saved_routes SET is_preferred = 1, updated_at = ? WHERE id = ? AND trip_id = ?',
    args: [new Date().toISOString(), savedRouteId, tripId]
  });
  await touchTrip(tripId);
}

export async function deleteSavedRoute(tripId: string, savedRouteId: string) {
  const savedRoute = await findSavedRoute(tripId, savedRouteId);

  if (!savedRoute) {
    throw new Error('Saved Route does not belong to this Trip.');
  }

  await db.execute({
    sql: 'DELETE FROM saved_routes WHERE id = ? AND trip_id = ?',
    args: [savedRouteId, tripId]
  });

  if (savedRoute.isPreferred) {
    await preferNewestSavedRouteForLeg(tripId, savedRoute.fromTripStopId, savedRoute.toTripStopId);
  }

  await touchTrip(tripId);
}

export async function renameSavedRoute(tripId: string, savedRouteId: string, title: string) {
  const savedRoute = await findSavedRoute(tripId, savedRouteId);

  if (!savedRoute) {
    throw new Error('Saved Route does not belong to this Trip.');
  }

  await db.execute({
    sql: 'UPDATE saved_routes SET title = ?, updated_at = ? WHERE id = ? AND trip_id = ?',
    args: [title, new Date().toISOString(), savedRouteId, tripId]
  });
  await touchTrip(tripId);
}

export async function findSavedRoute(tripId: string, savedRouteId: string) {
  const result = await db.execute({
    sql: `
      SELECT id, trip_id, from_trip_stop_id, to_trip_stop_id, route_option_id, title,
        is_preferred, snapshot_json, created_at, updated_at
      FROM saved_routes
      WHERE id = ? AND trip_id = ?
      LIMIT 1
    `,
    args: [savedRouteId, tripId]
  });

  const row = result.rows[0];
  return row ? rowToSavedRoute(row) : null;
}

async function countSavedRoutesForLeg(tripId: string, fromTripStopId: string, toTripStopId: string) {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS count
      FROM saved_routes
      WHERE trip_id = ? AND from_trip_stop_id = ? AND to_trip_stop_id = ?
    `,
    args: [tripId, fromTripStopId, toTripStopId]
  });

  return Number(result.rows[0]?.count ?? 0);
}

async function clearPreferredRoute(tripId: string, fromTripStopId: string, toTripStopId: string) {
  await db.execute({
    sql: `
      UPDATE saved_routes
      SET is_preferred = 0, updated_at = ?
      WHERE trip_id = ? AND from_trip_stop_id = ? AND to_trip_stop_id = ?
    `,
    args: [new Date().toISOString(), tripId, fromTripStopId, toTripStopId]
  });
}

async function preferNewestSavedRouteForLeg(tripId: string, fromTripStopId: string, toTripStopId: string) {
  const result = await db.execute({
    sql: `
      SELECT id
      FROM saved_routes
      WHERE trip_id = ? AND from_trip_stop_id = ? AND to_trip_stop_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [tripId, fromTripStopId, toTripStopId]
  });
  const nextPreferredId = result.rows[0]?.id;

  if (!nextPreferredId) return;

  await db.execute({
    sql: 'UPDATE saved_routes SET is_preferred = 1, updated_at = ? WHERE id = ? AND trip_id = ?',
    args: [new Date().toISOString(), String(nextPreferredId), tripId]
  });
}

function buildSnapshot(
  routeOption: RouteOption,
  routeSearch: RouteSearch,
  leg: Leg
): SavedRouteSnapshot {
  const fastestDuration = Math.min(...routeSearch.options.map((option) => option.durationSeconds));

  return {
    routeOptionId: routeOption.id,
    name: routeOption.name,
    source: routeOption.source,
    endpoints: {
      from: leg.from.routingPlace.searchLabel,
      to: leg.to.routingPlace.searchLabel
    },
    directness: routeSearch.directness,
    durationSeconds: routeOption.durationSeconds,
    distanceMeters: routeOption.distanceMeters,
    geometryJson: routeOption.geometryJson,
    interestScore: routeOption.interestScore,
    explanations: routeOption.explanations,
    reasons: routeOption.reasons,
    fastestBaselineDeltaSeconds: Math.max(0, routeOption.durationSeconds - fastestDuration),
    warnings: [],
    handoffStops: handoffStopsForRouteOption(routeOption)
  };
}

function handoffStopsForRouteOption(routeOption: RouteOption): HandoffStop[] {
  if (routeOption.source === 'ors-fastest') {
    return [];
  }

  return shapingStopsFromGeometry(routeOption.geometryJson);
}

function parseSnapshot(value: string): SavedRouteSnapshot {
  const snapshot = JSON.parse(value) as SavedRouteSnapshot;
  return {
    ...snapshot,
    reasons: snapshot.reasons ?? [],
    handoffStops: snapshot.handoffStops ?? []
  };
}

async function touchTrip(tripId: string) {
  await db.execute({
    sql: 'UPDATE trips SET updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), tripId]
  });
}
