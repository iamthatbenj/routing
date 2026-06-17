import { error, fail } from '@sveltejs/kit';
import { listHighlights } from '$lib/server/highlights';
import { latestSearchForLeg, listRouteSearchesForTrip, startRouteSearch } from '$lib/server/route-searches';
import type { Directness } from '$lib/server/route-searches';
import { deleteSavedRoute, listSavedRoutesForTrip, markSavedRoutePreferred, renameSavedRoute, saveRouteOption } from '$lib/server/saved-routes';
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
  const legs = deriveLegs(stops);
  const routeSearches = await listRouteSearchesForTrip(trip.id);
  const savedRoutes = await listSavedRoutesForTrip(trip.id);

  return {
    trip,
    editToken: params.token,
    routingPlaces: await listRoutingPlaces(),
    highlights: await listHighlights(),
    stops,
    legs: legs.map((leg) => ({
      ...leg,
      routeSearch: latestSearchForLeg(routeSearches, leg) ?? null,
      savedRoutes: savedRoutes.filter(
        (savedRoute) => savedRoute.fromTripStopId === leg.from.id && savedRoute.toTripStopId === leg.to.id
      )
    }))
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
  },

  startRouteSearch: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const fromStopId = formData.get('fromStopId');
    const toStopId = formData.get('toStopId');
    const rawDirectness = formData.get('directness');

    if (typeof fromStopId !== 'string' || typeof toStopId !== 'string') {
      return fail(400, { message: 'Choose a Leg for Route Search.' });
    }

    const directness = parseDirectness(rawDirectness);
    const stops = await listTripStops(trip.id);
    const legs = deriveLegs(stops);
    const leg = legs.find((candidate) => candidate.from.id === fromStopId && candidate.to.id === toStopId);

    if (!leg) {
      return fail(400, { message: 'That Leg does not belong to this Trip.' });
    }

    await startRouteSearch({ leg, directness });
    return { success: true };
  },

  saveRoute: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const fromStopId = formData.get('fromStopId');
    const toStopId = formData.get('toStopId');
    const routeSearchId = formData.get('routeSearchId');
    const routeOptionId = formData.get('routeOptionId');

    if (
      typeof fromStopId !== 'string' ||
      typeof toStopId !== 'string' ||
      typeof routeSearchId !== 'string' ||
      typeof routeOptionId !== 'string'
    ) {
      return fail(400, { message: 'Choose a Route Option to save.' });
    }

    const stops = await listTripStops(trip.id);
    const leg = deriveLegs(stops).find(
      (candidate) => candidate.from.id === fromStopId && candidate.to.id === toStopId
    );
    const routeSearch = (await listRouteSearchesForTrip(trip.id)).find(
      (candidate) => candidate.id === routeSearchId
    );

    if (!leg || !routeSearch) {
      return fail(400, { message: 'That Route Option does not belong to this Trip.' });
    }

    await saveRouteOption({ tripId: trip.id, leg, routeSearch, routeOptionId });
    return { success: true };
  },

  preferSavedRoute: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const savedRouteId = formData.get('savedRouteId');

    if (typeof savedRouteId !== 'string') {
      return fail(400, { message: 'Choose a Saved Route to prefer.' });
    }

    await markSavedRoutePreferred(trip.id, savedRouteId);
    return { success: true };
  },

  deleteSavedRoute: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const savedRouteId = formData.get('savedRouteId');

    if (typeof savedRouteId !== 'string') {
      return fail(400, { message: 'Choose a Saved Route to delete.' });
    }

    await deleteSavedRoute(trip.id, savedRouteId);
    return { success: true };
  },

  renameSavedRoute: async ({ request, params }) => {
    const trip = await loadEditableTrip(params.token);
    const formData = await request.formData();
    const savedRouteId = formData.get('savedRouteId');
    const rawTitle = formData.get('title');

    if (typeof savedRouteId !== 'string' || typeof rawTitle !== 'string') {
      return fail(400, { message: 'Choose a Saved Route title to update.' });
    }

    const title = rawTitle.trim();

    if (title.length === 0) {
      return fail(400, { message: 'Saved Route title cannot be empty.' });
    }

    if (title.length > 90) {
      return fail(400, { message: 'Saved Route title must be 90 characters or fewer.' });
    }

    await renameSavedRoute(trip.id, savedRouteId, title);
    return { success: true };
  }
};

function parseDirectness(value: FormDataEntryValue | null): Directness {
  return value === 'Direct' || value === 'Adventurous' ? value : 'Balanced';
}
