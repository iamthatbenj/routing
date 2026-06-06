import { randomUUID } from 'node:crypto';
import { gridDisk, latLngToCell } from 'h3-js';
import { db } from './db';
import { findHighlightsByH3Cells, type Highlight } from './highlights';
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
  interestScore: number;
  explanations: string[];
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

type LineStringGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

type ScoredRoute = OrsRoute & {
  interestScore: number;
  explanations: string[];
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
    sortOrder: Number(row.sort_order),
    interestScore: Number(row.interest_score ?? 0),
    explanations: parseExplanations(String(row.explanation_json ?? '[]'))
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
        route_options.duration_seconds, route_options.distance_meters, route_options.geometry_json,
        route_options.sort_order, route_options.interest_score, route_options.explanation_json
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
    const scoredRoutes = await scoreRouteOptions(routes, leg, directness);
    await replaceRouteOptions(searchId, scoredRoutes);
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

  for (const anchorLabel of [
    'Colorado National Monument, Colorado',
    'Black Canyon of the Gunnison, Colorado'
  ]) {
    const anchor = await findRoutingPlaceBySearchLabel(anchorLabel);
    if (anchor && anchor.id !== from.id && anchor.id !== to.id) {
      try {
        routes.push(...(await fetchDrivingRoutes({ from, to, via: anchor })));
      } catch {
        // Keep the direct Route Search useful even if a tracer-bullet Anchor route fails.
      }
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

async function scoreRouteOptions(routes: OrsRoute[], leg: Leg, directness: Directness): Promise<ScoredRoute[]> {
  const fastestDuration = Math.min(...routes.map((route) => route.durationSeconds));

  return Promise.all(
    routes.map(async (route) => {
      const highlights = await findHighlightsByH3Cells(routeCorridorCells(route.geometry), 5);
      const scoredHighlights = highlights.filter(
        (highlight) => !isEndpointContextHighlight(highlight, leg)
      );
      const endpointContext = highlights.filter((highlight) => isEndpointContextHighlight(highlight, leg));
      const highlightScore = scoredHighlights.reduce(
        (total, highlight) => total + highlightWeight(highlight),
        0
      );
      const penalty = directnessPenalty(route.durationSeconds - fastestDuration, directness);
      const interestScore = Math.max(0, Math.round(highlightScore - penalty));

      return {
        ...route,
        interestScore,
        explanations: buildExplanations(scoredHighlights, endpointContext, route.durationSeconds - fastestDuration)
      };
    })
  );
}

function routeCorridorCells(geometry: unknown) {
  const line = geometry as LineStringGeometry;
  if (line.type !== 'LineString' || !Array.isArray(line.coordinates)) return [];

  const cells = new Set<string>();
  const sampleEvery = Math.max(1, Math.floor(line.coordinates.length / 120));

  line.coordinates.forEach(([longitude, latitude], index) => {
    if (index % sampleEvery !== 0 && index !== line.coordinates.length - 1) return;
    for (const cell of gridDisk(latLngToCell(latitude, longitude, 5), 1)) {
      cells.add(cell);
    }
  });

  return [...cells];
}

function isEndpointContextHighlight(highlight: Highlight, leg: Leg) {
  return (
    highlight.endpointContextPlaceId === leg.from.routingPlace.id ||
    highlight.endpointContextPlaceId === leg.to.routingPlace.id
  );
}

function highlightWeight(highlight: Highlight) {
  const categoryMultiplier = highlight.category === 'scenic_segment' ? 1.15 : 1;
  return highlight.strength * categoryMultiplier;
}

function directnessPenalty(extraSeconds: number, directness: Directness) {
  const extraMinutes = Math.max(0, extraSeconds / 60);
  const penaltyPerMinute = directness === 'Direct' ? 0.45 : directness === 'Adventurous' ? 0.08 : 0.18;
  return extraMinutes * penaltyPerMinute;
}

function buildExplanations(scoredHighlights: Highlight[], endpointContext: Highlight[], extraSeconds: number) {
  const explanations = scoredHighlights.slice(0, 3).map((highlight) => {
    const label = highlight.category === 'scenic_segment' ? 'Scenic Segment' : 'Highlight';
    return `${label}: ${highlight.name} (${highlight.visitEffort})`;
  });

  if (extraSeconds > 0) {
    explanations.push(`${formatDuration(extraSeconds)} slower than the fastest baseline.`);
  } else {
    explanations.push('Fastest baseline for comparison.');
  }

  if (endpointContext.length > 0) {
    explanations.push(
      `Destination context, not scored: ${endpointContext
        .slice(0, 2)
        .map((highlight) => highlight.name)
        .join(', ')}.`
    );
  }

  return explanations;
}

async function replaceRouteOptions(routeSearchId: string, routes: ScoredRoute[]) {
  await db.execute({ sql: 'DELETE FROM route_options WHERE route_search_id = ?', args: [routeSearchId] });

  if (routes.length === 0) {
    throw new Error('Route Search produced no Route Options.');
  }

  await db.batch(
    routes.map((route, index) => ({
      sql: `
        INSERT INTO route_options (
          id, route_search_id, name, source, duration_seconds, distance_meters,
          geometry_json, sort_order, interest_score, explanation_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        routeSearchId,
        route.name,
        route.source,
        route.durationSeconds,
        route.distanceMeters,
        JSON.stringify(route.geometry),
        index + 1,
        route.interestScore,
        JSON.stringify(route.explanations)
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

function parseExplanations(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
