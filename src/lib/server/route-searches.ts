import { randomUUID } from 'node:crypto';
import { routeCorridorCells, selectCorridorRouteOptions } from '$lib/route-corridors';
import { parseRouteReasons, type RouteReason } from '$lib/route-reasons';
import { assessDirectnessConstraint, parseDirectnessConstraint, type DirectnessConstraintAssessment } from '$lib/directness-constraints';
import { db } from './db';
import { findHighlightsByH3Cells, listHighlights, type Highlight } from './highlights';
import { fetchDrivingRoutes, OrsRouteError, type OrsRoute } from './ors';
import { listImportantRoutingPlacesForAnchors } from './routing-places';
import { highlightToAnchorCandidate, routingPlaceToAnchorCandidate, selectRelevantAnchors } from './anchor-selection';
import type { Leg } from './trip-stops';
import type { RoutingPlace } from './routing-places';

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
  reasons: RouteReason[];
  directnessConstraint: DirectnessConstraintAssessment;
};

export type RouteSearchDiagnostics = {
  provider: 'ors';
  outcome: 'running' | 'complete' | 'fallback_complete' | 'failed';
  routeSources: string[];
  optionCount: number;
  usedFallback: boolean;
  errorCategory?: string;
  errorStatus?: number;
};

export type RouteSearch = {
  id: string;
  tripId: string;
  fromTripStopId: string;
  toTripStopId: string;
  directness: Directness;
  status: 'running' | 'complete' | 'failed';
  errorMessage: string;
  provider: string;
  diagnostics: RouteSearchDiagnostics;
  createdAt: string;
  updatedAt: string;
  options: RouteOption[];
};

type ScoredRoute = OrsRoute & {
  interestScore: number;
  explanations: string[];
  reasons: RouteReason[];
  directnessConstraint: DirectnessConstraintAssessment;
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
    provider: String(row.provider ?? 'ors'),
    diagnostics: parseDiagnostics(String(row.diagnostic_json ?? '{}')),
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
    explanations: parseExplanations(String(row.explanation_json ?? '[]')),
    reasons: parseRouteReasons(String(row.reason_json ?? '[]')),
    directnessConstraint: parseDirectnessConstraint(String(row.constraint_json ?? '{}'))
  };
}

export async function listRouteSearchesForTrip(tripId: string) {
  const searchesResult = await db.execute({
    sql: `
      SELECT id, trip_id, from_trip_stop_id, to_trip_stop_id, directness, status, error_message, provider, diagnostic_json, created_at, updated_at
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
        route_options.sort_order, route_options.interest_score, route_options.explanation_json,
        route_options.reason_json, route_options.constraint_json
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
      INSERT INTO route_searches (id, trip_id, from_trip_stop_id, to_trip_stop_id, directness, status, provider, diagnostic_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'running', 'ors', ?, ?, ?)
    `,
    args: [searchId, leg.from.tripId, leg.from.id, leg.to.id, directness, JSON.stringify(runningDiagnostics()), now, now]
  });

  try {
    const { routes, providerFailure } = await generateRouteOptions(leg);
    const scoredRoutes = await scoreRouteOptions(routes, leg, directness);
    const selectedRoutes = selectCorridorRouteOptions(scoredRoutes);
    await replaceRouteOptions(searchId, selectedRoutes);
    await updateRouteSearchStatus(searchId, 'complete', '', successDiagnostics(selectedRoutes, providerFailure));
  } catch (error) {
    logRouteSearchFailure(error);
    await updateRouteSearchStatus(searchId, 'failed', routeSearchFailureMessage(error), failureDiagnostics(error));
  }

  return searchId;
}

async function generateRouteOptions(leg: Leg): Promise<{ routes: OrsRoute[]; providerFailure?: unknown }> {
  const from = leg.from.routingPlace;
  const to = leg.to.routingPlace;
  let routes: OrsRoute[];

  try {
    routes = await fetchDrivingRoutes({ from, to });
  } catch (error) {
    logRouteSearchFailure(error);
    return { routes: await generateFallbackAnchorCorridors(leg), providerFailure: error };
  }

  for (const anchor of await selectAnchorsForLeg(leg)) {
    try {
      routes.push(...(await fetchDrivingRoutes({ from, to, via: anchor })));
    } catch {
      // Keep the direct Route Search useful even if an Anchor route fails.
    }
  }

  return { routes: dedupeExactRoutes(routes) };
}

export async function generateFallbackAnchorCorridors(leg: Leg) {
  const from = leg.from.routingPlace;
  const to = leg.to.routingPlace;
  const routes: OrsRoute[] = [fallbackRoute({ from, to })];

  for (const anchor of await selectAnchorsForLeg(leg)) {
    routes.push(fallbackRoute({ from, to, via: anchor }));
  }

  return dedupeExactRoutes(routes);
}

async function selectAnchorsForLeg(leg: Leg) {
  const highlights = await listHighlights();
  const importantRoutingPlaces = await listImportantRoutingPlacesForAnchors();
  const candidates = [
    ...highlights.map(highlightToAnchorCandidate),
    ...importantRoutingPlaces.map(routingPlaceToAnchorCandidate)
  ];

  return selectRelevantAnchors(leg.from.routingPlace, leg.to.routingPlace, candidates);
}

export function fallbackRoute({ from, to, via }: { from: RoutingPlace; to: RoutingPlace; via?: RoutingPlace }): OrsRoute {
  const distanceMeters = via
    ? approximateDistanceMeters(from, via) + approximateDistanceMeters(via, to)
    : approximateDistanceMeters(from, to);
  const durationSeconds = Math.round(distanceMeters / 22.2);

  return {
    name: via ? `Approximate via ${via.name}` : 'Approximate direct Corridor',
    source: via ? 'fallback-anchor' : 'fallback-direct',
    durationSeconds,
    distanceMeters: Math.round(distanceMeters),
    geometry: {
      type: 'LineString',
      coordinates: via
        ? [toCoordinate(from), toCoordinate(via), toCoordinate(to)]
        : [toCoordinate(from), toCoordinate(to)]
    }
  };
}

function toCoordinate(place: RoutingPlace): [number, number] {
  return [place.longitude, place.latitude];
}

function approximateDistanceMeters(from: RoutingPlace, to: RoutingPlace) {
  const earthRadiusMeters = 6_371_000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function dedupeExactRoutes(routes: OrsRoute[]) {
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
      const extraSeconds = route.durationSeconds - fastestDuration;
      const penalty = directnessPenalty(extraSeconds, directness);
      const interestScore = Math.max(0, Math.round(highlightScore - penalty));
      const reasons = buildReasons(route, scoredHighlights, endpointContext, extraSeconds, directness, penalty);
      const directnessConstraint = assessDirectnessConstraint({
        directness,
        durationSeconds: route.durationSeconds,
        fastestDurationSeconds: fastestDuration,
        source: route.source,
        hasStrongReason: interestScore >= 60 || reasons.some((reason) => reason.kind === 'anchor' || reason.kind === 'highlight')
      });

      return {
        ...route,
        interestScore,
        explanations: buildExplanations(scoredHighlights, endpointContext, extraSeconds, route, directnessConstraint),
        reasons,
        directnessConstraint
      };
    })
  );
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

function buildReasons(route: OrsRoute, scoredHighlights: Highlight[], endpointContext: Highlight[], extraSeconds: number, directness: Directness, penalty: number): RouteReason[] {
  const reasons: RouteReason[] = [];
  const anchorLabel = anchorLabelForRoute(route);

  if (anchorLabel) {
    reasons.push({ kind: 'anchor', label: anchorLabel });
  }

  reasons.push(
    ...scoredHighlights.slice(0, 5).map((highlight) => ({
      kind: 'highlight' as const,
      label: highlight.name,
      category: highlight.category,
      visitEffort: highlight.visitEffort,
      scoreImpact: highlightWeight(highlight)
    }))
  );

  reasons.push({ kind: 'tradeoff', extraSeconds: Math.max(0, extraSeconds), directness, penalty });

  if (endpointContext.length > 0) {
    reasons.push({ kind: 'endpoint_context', labels: endpointContext.map((highlight) => highlight.name) });
  }

  return reasons;
}

function anchorLabelForRoute(route: OrsRoute) {
  if (route.source === 'ors-anchor' && route.name.startsWith('Via ')) return route.name.replace(/^Via /, '').trim();
  if (route.source === 'fallback-anchor' && route.name.startsWith('Approximate via ')) return route.name.replace(/^Approximate via /, '').trim();
  return '';
}

function buildExplanations(
  scoredHighlights: Highlight[],
  endpointContext: Highlight[],
  extraSeconds: number,
  route?: OrsRoute,
  directnessConstraint?: DirectnessConstraintAssessment
) {
  if (route?.source.startsWith('fallback-')) {
    const explanations = [
      'Approximate fallback Corridor. Route provider geometry was unavailable, so this is planning scaffolding rather than turn-by-turn routing.'
    ];

    const anchorLabel = anchorLabelForRoute(route);
    if (anchorLabel) {
      explanations.push(`Approximate Anchor path via ${anchorLabel}.`);
    }

    if (endpointContext.length > 0) {
      explanations.push(
        `Endpoint context, not scored: ${endpointContext
          .slice(0, 2)
          .map((highlight) => highlight.name)
          .join(', ')}.`
      );
    }

    return explanations;
  }

  const explanations = scoredHighlights.slice(0, 3).map((highlight) => {
    const label = highlight.category === 'scenic_segment' ? 'Scenic Segment' : 'Highlight';
    return `${label}: ${highlight.name} (${highlight.visitEffort})`;
  });

  if (extraSeconds > 0) {
    explanations.push(`${formatDuration(extraSeconds)} slower than the fastest baseline.`);
  } else {
    explanations.push('Fastest baseline for comparison.');
  }

  if (directnessConstraint?.status === 'constrained') {
    explanations.push(`Constrained Route Option: ${directnessConstraint.reason}`);
  }

  if (endpointContext.length > 0) {
    explanations.push(
      `Endpoint context, not scored: ${endpointContext
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
          geometry_json, sort_order, interest_score, explanation_json, reason_json, constraint_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(route.explanations),
        JSON.stringify(route.reasons),
        JSON.stringify(route.directnessConstraint)
      ]
    }))
  );
}

export function routeSearchFailureMessage(error: unknown) {
  if (error instanceof OrsRouteError) return error.message;

  return 'Route Search failed before Route Options could be created. Try again later.';
}

function logRouteSearchFailure(error: unknown) {
  if (error instanceof OrsRouteError) {
    console.warn('[route-search] provider failure', {
      provider: 'ors',
      category: error.category,
      status: error.status
    });
    return;
  }

  console.warn('[route-search] unexpected failure', {
    provider: 'ors',
    category: 'unexpected'
  });
}

function runningDiagnostics(): RouteSearchDiagnostics {
  return {
    provider: 'ors',
    outcome: 'running',
    routeSources: [],
    optionCount: 0,
    usedFallback: false
  };
}

export function successDiagnostics(routes: Array<{ source: string }>, providerFailure?: unknown): RouteSearchDiagnostics {
  const usedFallback = routes.some((route) => route.source.startsWith('fallback-'));
  return {
    provider: 'ors',
    outcome: usedFallback ? 'fallback_complete' : 'complete',
    routeSources: [...new Set(routes.map((route) => route.source))],
    optionCount: routes.length,
    usedFallback,
    ...diagnosticErrorFields(providerFailure)
  };
}

export function failureDiagnostics(error: unknown): RouteSearchDiagnostics {
  return {
    provider: 'ors',
    outcome: 'failed',
    routeSources: [],
    optionCount: 0,
    usedFallback: false,
    ...diagnosticErrorFields(error)
  };
}

function diagnosticErrorFields(error: unknown) {
  if (error instanceof OrsRouteError) {
    return {
      errorCategory: error.category,
      ...(typeof error.status === 'number' ? { errorStatus: error.status } : {})
    };
  }

  if (error) return { errorCategory: 'unexpected' };
  return {};
}

async function updateRouteSearchStatus(id: string, status: RouteSearch['status'], errorMessage = '', diagnostics: RouteSearchDiagnostics = runningDiagnostics()) {
  await db.execute({
    sql: 'UPDATE route_searches SET status = ?, error_message = ?, diagnostic_json = ?, updated_at = ? WHERE id = ?',
    args: [status, errorMessage, JSON.stringify(diagnostics), new Date().toISOString(), id]
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

function parseDiagnostics(value: string): RouteSearchDiagnostics {
  try {
    const parsed = JSON.parse(value) as Partial<RouteSearchDiagnostics>;
    return {
      provider: 'ors',
      outcome:
        parsed.outcome === 'complete' || parsed.outcome === 'fallback_complete' || parsed.outcome === 'failed' || parsed.outcome === 'running'
          ? parsed.outcome
          : 'running',
      routeSources: Array.isArray(parsed.routeSources) ? parsed.routeSources.map(String) : [],
      optionCount: Number.isFinite(parsed.optionCount) ? Number(parsed.optionCount) : 0,
      usedFallback: Boolean(parsed.usedFallback),
      ...(typeof parsed.errorCategory === 'string' ? { errorCategory: parsed.errorCategory } : {}),
      ...(typeof parsed.errorStatus === 'number' ? { errorStatus: parsed.errorStatus } : {})
    };
  } catch {
    return runningDiagnostics();
  }
}
