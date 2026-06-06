import { randomUUID } from 'node:crypto';
import { db } from './db';
import { fetchDrivingRoutes, type OrsRoute } from './ors';
import { findRoutingPlaceBySearchLabel } from './routing-places';
import type { Leg } from './trip-stops';

export type Directness = 'Direct' | 'Balanced' | 'Adventurous';

export type RouteOption = {
  id: string;
  routeSearchId: string;
  name: string;
  source: string;
  durationSeconds: number;
  distanceMeters: number;
  geometryJson: string;
  sortOrder: number;
};

export type RouteSearch = {
  id: string;
  tripId: string;
  fromTripStopId: string;
  toTripStopId: string;
  directness: Directness;
  status: 'running' | 'complete' | 'failed';
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
  options: RouteOption[];
};

function rowToRouteSearch(row: Record<string, unknown>, options: RouteOption[]): RouteSearch {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    fromTripStopId: String(row.from_trip_stop_id),
    toTripStopId: String(row.to_trip_stop_id),
    directness: String(row.directness) as Directness,
    status: String(row.status) as RouteSearch['status'],
    errorMessage: String(row.error_message ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    options
  };
}

function rowToRouteOption(row: Record<string, unknown>): RouteOption {
  return {
    id: String(row.id),
    routeSearchId: String(row.route_search_id),
    name: String(row.name),
    source: String(row.source),
    durationSeconds: Number(row.duration_seconds),
    distanceMeters: Number(row.distance_meters),
    geometryJson: String(row.geometry_json),
    sortOrder: Number(row.sort_order)
  };
}

export async function listRouteSearchesForTrip(tripId: string) {
  const searchesResult = await db.execute({
    sql: `
      SELECT id, trip_id, from_trip_stop_id, to_trip_stop_id, directness, status, error_message, created_at, updated_at
      FROM route_searches
      WHERE trip_id = ?
      ORDER BY created_at DESC
    `,
    args: [tripId]
  });

  const optionsResult = await db.execute({
    sql: `
      SELECT route_options.id, route_options.route_search_id, route_options.name, route_options.source,
        route_options.duration_seconds, route_options.distance_meters, route_options.geometry_json, route_options.sort_order
      FROM route_options
      JOIN route_searches ON route_searches.id = route_options.route_search_id
      WHERE route_searches.trip_id = ?
      ORDER BY route_options.sort_order
    `,
    args: [tripId]
  });

  const optionsBySearch = new Map<string, RouteOption[]>();
  for (const row of optionsResult.rows) {
    const option = rowToRouteOption(row);
    const options = optionsBySearch.get(option.routeSearchId) ?? [];
    options.push(option);
    optionsBySearch.set(option.routeSearchId, options);
  }

  return searchesResult.rows.map((row) => rowToRouteSearch(row, optionsBySearch.get(String(row.id)) ?? []));
}

export async function startRouteSearch({ leg, directness }: { leg: Leg; directness: Directness }) {
  const searchId = randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO route_searches (id, trip_id, from_trip_stop_id, to_trip_stop_id, directness, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
    `,
    args: [searchId, leg.from.tripId, leg.from.id, leg.to.id, directness, now, now]
  });

  try {
    const routes = await generateRouteOptions(leg);
    await replaceRouteOptions(searchId, routes);
    await updateRouteSearchStatus(searchId, 'complete');
  } catch (error) {
    await updateRouteSearchStatus(searchId, 'failed', error instanceof Error ? error.message : 'Route Search failed.');
  }

  return searchId;
}

async function generateRouteOptions(leg: Leg) {
  const from = leg.from.routingPlace;
  const to = leg.to.routingPlace;
  const routes = await fetchDrivingRoutes({ from, to });

  const anchor = await findRoutingPlaceBySearchLabel('Colorado National Monument, Colorado');
  if (anchor && anchor.id !== from.id && anchor.id !== to.id) {
    try {
      routes.push(...(await fetchDrivingRoutes({ from, to, via: anchor })));
    } catch {
      // Keep the direct Route Search useful even if the tracer-bullet Anchor route fails.
    }
  }

  return dedupeRoutes(routes).slice(0, 4);
}

function dedupeRoutes(routes: OrsRoute[]) {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${Math.round(route.durationSeconds / 60)}-${Math.round(route.distanceMeters / 1000)}-${route.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function replaceRouteOptions(routeSearchId: string, routes: OrsRoute[]) {
  await db.execute({ sql: 'DELETE FROM route_options WHERE route_search_id = ?', args: [routeSearchId] });

  if (routes.length === 0) {
    throw new Error('Route Search produced no Route Options.');
  }

  await db.batch(
    routes.map((route, index) => ({
      sql: `
        INSERT INTO route_options (id, route_search_id, name, source, duration_seconds, distance_meters, geometry_json, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        routeSearchId,
        route.name,
        route.source,
        route.durationSeconds,
        route.distanceMeters,
        JSON.stringify(route.geometry),
        index + 1
      ]
    }))
  );
}

async function updateRouteSearchStatus(id: string, status: RouteSearch['status'], errorMessage = '') {
  await db.execute({
    sql: 'UPDATE route_searches SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
    args: [status, errorMessage, new Date().toISOString(), id]
  });
}

export function latestSearchForLeg(searches: RouteSearch[], leg: Leg) {
  return searches.find(
    (search) => search.fromTripStopId === leg.from.id && search.toTripStopId === leg.to.id
  );
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
}

export function formatDistance(meters: number) {
  return `${Math.round(meters / 1609.344)} mi`;
}
