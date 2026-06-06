import { error } from '@sveltejs/kit';
import { appleMapsUrl, googleMapsUrl, routeGeometryWarning } from '$lib/leg-handoff';
import { findSavedRoute } from '$lib/server/saved-routes';
import { findTripByEditToken } from '$lib/server/trips';

export const load = async ({ params, url }) => {
  const trip = await findTripByEditToken(params.token);

  if (!trip) {
    throw error(404, 'Trip edit link not found');
  }

  const savedRoute = await findSavedRoute(trip.id, params.savedRouteId);

  if (!savedRoute || !savedRoute.isPreferred) {
    throw error(404, 'Preferred Saved Route not found');
  }

  return {
    trip,
    savedRoute,
    appContextUrl: url.toString(),
    googleMapsUrl: googleMapsUrl(savedRoute),
    appleMapsUrl: appleMapsUrl(savedRoute),
    geometryWarning: routeGeometryWarning(savedRoute)
  };
};
