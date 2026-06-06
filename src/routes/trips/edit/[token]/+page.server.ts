import { error, fail } from '@sveltejs/kit';
import { findRoutingPlaceBySearchLabel, listRoutingPlaces } from '$lib/server/routing-places';
import { addTripStop, deriveLegs, listTripStops, moveTripStop } from '$lib/server/trip-stops';
import { findTripByEditToken } from '$lib/server/trips';

async function loadEditableTrip(token: string) {
  const trip = await findTripByEditToken(token);

  if (!trip) {
    throw error(404, 'Trip edit link not found');
  }

  return trip;
}

export const load = async ({ params }) => {
  const trip = await loadEditableTrip(params.token);
  const stops = await listTripStops(trip.id);

  return {
    trip,
    editToken: params.token,
    routingPlaces: await listRoutingPlaces(),
    stops,
    legs: deriveLegs(stops)
  };
};

export const actions = {
  addStop: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const rawRoutingPlace = formData.get('routingPlace');
    const details = formData.get('details');

    if (typeof rawRoutingPlace !== 'string' || !rawRoutingPlace.trim()) {
      return fail(400, { message: 'Choose a Routing Place to add as a Trip Stop.' });
    }

    const routingPlace = await findRoutingPlaceBySearchLabel(rawRoutingPlace.trim());

    if (!routingPlace) {
      return fail(400, { message: 'That Routing Place is not in the app-owned gazetteer yet.' });
    }

    await addTripStop(trip.id, routingPlace.id, typeof details === 'string' ? details.trim() : '');
    return { success: true };
  },

  moveStop: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const stopId = formData.get('stopId');
    const direction = formData.get('direction');

    if (typeof stopId !== 'string' || (direction !== 'up' && direction !== 'down')) {
      return fail(400, { message: 'Choose a Trip Stop and direction to reorder.' });
    }

    await moveTripStop(trip.id, stopId, direction);
    return { success: true };
  }
};
