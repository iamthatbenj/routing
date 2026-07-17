import type { RouteReason } from '$lib/route-reasons';
import { listHighlightsByNames, type Highlight } from './highlights';
import type { RouteOption } from './route-searches';
import type { SavedRoute } from './saved-routes';

export function relevantHighlightNamesFromReasons(reasons: RouteReason[]) {
  const names = new Set<string>();

  for (const reason of reasons) {
    if (reason.kind === 'anchor' || reason.kind === 'highlight') {
      names.add(reason.label);
    }

    if (reason.kind === 'endpoint_context') {
      for (const label of reason.labels) names.add(label);
    }
  }

  return [...names];
}

export function relevantHighlightNamesFromRouteOptions(routeOptions: Array<Pick<RouteOption, 'reasons'>>) {
  return [...new Set(routeOptions.flatMap((option) => relevantHighlightNamesFromReasons(option.reasons)))];
}

export function relevantHighlightNamesFromSavedRoutes(savedRoutes: Array<Pick<SavedRoute, 'snapshot'>>) {
  return [...new Set(savedRoutes.flatMap((route) => relevantHighlightNamesFromReasons(route.snapshot.reasons)))];
}

export async function listHighlightsRelevantToRouteOptions(routeOptions: Array<Pick<RouteOption, 'reasons'>>): Promise<Highlight[]> {
  return listHighlightsByNames(relevantHighlightNamesFromRouteOptions(routeOptions));
}

export async function listHighlightsRelevantToSavedRoutes(savedRoutes: Array<Pick<SavedRoute, 'snapshot'>>): Promise<Highlight[]> {
  return listHighlightsByNames(relevantHighlightNamesFromSavedRoutes(savedRoutes));
}
