import { error } from '@sveltejs/kit';
import { appleMapsUrl, googleMapsUrl, routeGeometryWarning } from '$lib/leg-handoff';
import { findRoutingPlaceBySearchLabel } from '$lib/server/routing-places';
import { findSavedRoute } from '$lib/server/saved-routes';
import { listTripStops } from '$lib/server/trip-stops';
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

  const tripStops = await listTripStops(trip.id);
  const fromStop = tripStops.find((stop) => stop.id === savedRoute.fromTripStopId);
  const toStop = tripStops.find((stop) => stop.id === savedRoute.toTripStopId);
  const shapingStops = await Promise.all(
    savedRoute.snapshot.handoffStops.map(async (stop, index) => {
      const routingPlace = await findRoutingPlaceBySearchLabel(stop.label);
      return routingPlace
        ? {
            id: `shaping-${index}-${routingPlace.id}`,
            label: stop.label,
            kind: 'shaping' as const,
            latitude: routingPlace.latitude,
            longitude: routingPlace.longitude
          }
        : null;
    })
  );

  return {
    trip,
    savedRoute,
    mapRouteOption: {
      id: savedRoute.id,
      name: savedRoute.title,
      source: savedRoute.snapshot.source,
      geometryJson: savedRoute.snapshot.geometryJson
    },
    mapStops: [
      fromStop
        ? {
            id: `endpoint-from-${fromStop.id}`,
            label: fromStop.routingPlace.searchLabel,
            kind: 'endpoint' as const,
            latitude: fromStop.routingPlace.latitude,
            longitude: fromStop.routingPlace.longitude
          }
        : null,
      toStop
        ? {
            id: `endpoint-to-${toStop.id}`,
            label: toStop.routingPlace.searchLabel,
            kind: 'endpoint' as const,
            latitude: toStop.routingPlace.latitude,
            longitude: toStop.routingPlace.longitude
          }
        : null,
      ...shapingStops
    ].filter((stop) => stop !== null),
    appContextUrl: url.toString(),
    googleMapsUrl: googleMapsUrl(savedRoute),
    appleMapsUrl: appleMapsUrl(savedRoute),
    geometryWarning: routeGeometryWarning(savedRoute)
  };
};
