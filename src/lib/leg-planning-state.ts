export type LegPlanningStateInput = {
  routeSearch: null | {
    status: string;
    options: Array<{ source: string }>;
    diagnostics?: { usedFallback?: boolean };
  };
  savedRoutes: Array<{ isPreferred: boolean }>;
};

export type LegPlanningStateKind =
  | 'needs_route_search'
  | 'route_search_failed'
  | 'route_search_running'
  | 'fallback_corridors_only'
  | 'choose_route_option'
  | 'choose_preferred_saved_route'
  | 'ready_for_handoff';

export type LegPlanningState = {
  kind: LegPlanningStateKind;
  label: string;
  summary: string;
  action: string;
};

export function deriveLegPlanningState(leg: LegPlanningStateInput): LegPlanningState {
  const preferredRoute = leg.savedRoutes.find((savedRoute) => savedRoute.isPreferred);

  if (preferredRoute) {
    return {
      kind: 'ready_for_handoff',
      label: 'Preferred Saved Route selected',
      summary: 'This current Leg has a Preferred Saved Route ready for Leg Handoff.',
      action: 'Open the Leg Handoff when you are ready to drive.'
    };
  }

  if (!leg.routeSearch) {
    return {
      kind: 'needs_route_search',
      label: 'Needs Route Search',
      summary: 'This current Leg does not have a Route Search yet.',
      action: 'Run a Route Search to compare Route Options for this Leg.'
    };
  }

  if (leg.routeSearch.status === 'failed') {
    return {
      kind: 'route_search_failed',
      label: 'Route Search failed',
      summary: 'The latest Route Search for this current Leg did not produce usable Route Options.',
      action: 'Review the Route Search message, then try comparing Route Options again.'
    };
  }

  if (leg.routeSearch.status === 'running') {
    return {
      kind: 'route_search_running',
      label: 'Route Search running',
      summary: 'Routing is still building Route Options for this current Leg.',
      action: 'Wait for the Route Search to finish before choosing a Saved Route.'
    };
  }

  const hasFallbackOnly =
    leg.routeSearch.options.length > 0 &&
    leg.routeSearch.options.every((option) => option.source.startsWith('fallback-'));

  if (hasFallbackOnly || leg.routeSearch.diagnostics?.usedFallback) {
    return {
      kind: 'fallback_corridors_only',
      label: 'Fallback Corridors only',
      summary: 'This current Leg has approximate fallback Corridors, but no provider-backed Saved Route for Leg Handoff.',
      action: 'Try the Route Search again before saving a Preferred Saved Route for Leg Handoff.'
    };
  }

  if (leg.savedRoutes.length > 0) {
    return {
      kind: 'choose_preferred_saved_route',
      label: 'Choose a Preferred Saved Route',
      summary: 'This current Leg has Saved Routes, but none is marked as the Preferred Saved Route.',
      action: 'Choose which Saved Route should be the Preferred Saved Route for this Leg.'
    };
  }

  if (leg.routeSearch.options.length > 0) {
    return {
      kind: 'choose_route_option',
      label: 'Choose a Route Option',
      summary: 'This current Leg has Route Options, but no Saved Route yet.',
      action: 'Save a Route Option, then mark the route you want as the Preferred Saved Route.'
    };
  }

  return {
    kind: 'needs_route_search',
    label: 'Needs Route Search',
    summary: 'This current Leg does not have Route Options yet.',
    action: 'Run a Route Search to compare Route Options for this Leg.'
  };
}
