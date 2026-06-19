import { error } from '@sveltejs/kit';
import { listSavedRoutesForTrip } from '$lib/server/saved-routes';
import { deriveLegs, listTripStops } from '$lib/server/trip-stops';
import { findTripByShareToken } from '$lib/server/trips';

export const load = async ({ params }) => {
  const trip = await findTripByShareToken(params.token);

  if (!trip) {
    throw error(404, 'Trip share link not found');
  }

  const stops = await listTripStops(trip.id);
  const savedRoutes = await listSavedRoutesForTrip(trip.id);
  const legs = deriveLegs(stops).map((leg) => ({
    ...leg,
    preferredSavedRoute:
      savedRoutes.find(
        (savedRoute) =>
          savedRoute.fromTripStopId === leg.from.id &&
          savedRoute.toTripStopId === leg.to.id &&
          savedRoute.isPreferred
      ) ?? null
  }));

  return { trip, stops, legs };
};
