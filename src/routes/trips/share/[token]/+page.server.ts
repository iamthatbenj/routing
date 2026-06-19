import { error } from '@sveltejs/kit';
import { listHighlights } from '$lib/server/highlights';
import { findRoutingPlaceBySearchLabel } from '$lib/server/routing-places';
import { listSavedRoutesForTrip, type HandoffStop } from '$lib/server/saved-routes';
import { deriveLegs, listTripStops } from '$lib/server/trip-stops';
import { findTripByShareToken } from '$lib/server/trips';

export const load = async ({ params }) => {
  const trip = await findTripByShareToken(params.token);

  if (!trip) {
    throw error(404, 'Trip share link not found');
  }

  const stops = await listTripStops(trip.id);
  const savedRoutes = await listSavedRoutesForTrip(trip.id);
  const legs = await Promise.all(
    deriveLegs(stops).map(async (leg) => {
      const preferredSavedRoute =
        savedRoutes.find(
          (savedRoute) =>
            savedRoute.fromTripStopId === leg.from.id &&
            savedRoute.toTripStopId === leg.to.id &&
            savedRoute.isPreferred
        ) ?? null;

      return {
        ...leg,
        preferredSavedRoute,
        mapRouteOption: preferredSavedRoute
          ? {
              id: preferredSavedRoute.id,
              name: preferredSavedRoute.title,
              source: preferredSavedRoute.snapshot.source,
              geometryJson: preferredSavedRoute.snapshot.geometryJson
            }
          : null,
        mapStops: preferredSavedRoute
          ? [
              {
                id: `endpoint-from-${leg.from.id}`,
                label: leg.from.routingPlace.searchLabel,
                kind: 'endpoint' as const,
                latitude: leg.from.routingPlace.latitude,
                longitude: leg.from.routingPlace.longitude
              },
              {
                id: `endpoint-to-${leg.to.id}`,
                label: leg.to.routingPlace.searchLabel,
                kind: 'endpoint' as const,
                latitude: leg.to.routingPlace.latitude,
                longitude: leg.to.routingPlace.longitude
              },
              ...(await mapStopsForHandoffStops(preferredSavedRoute.snapshot.handoffStops))
            ]
          : []
      };
    })
  );

  return { trip, stops, legs, highlights: await listHighlights() };
};

async function mapStopsForHandoffStops(handoffStops: HandoffStop[]) {
  return (
    await Promise.all(
      handoffStops.map(async (stop, index) => {
        if (Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)) {
          return {
            id: `shaping-${index}`,
            label: stop.displayLabel ?? stop.label,
            kind: 'shaping' as const,
            latitude: Number(stop.latitude),
            longitude: Number(stop.longitude)
          };
        }

        const routingPlace = await findRoutingPlaceBySearchLabel(stop.label);
        return routingPlace
          ? {
              id: `shaping-${index}-${routingPlace.id}`,
              label: stop.displayLabel ?? stop.label,
              kind: 'shaping' as const,
              latitude: routingPlace.latitude,
              longitude: routingPlace.longitude
            }
          : null;
      })
    )
  ).filter((stop) => stop !== null);
}
