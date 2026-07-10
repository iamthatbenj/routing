export type TripPlanningCopy = {
  tripStopsHeading: string;
  tripStopsSummary: string;
  routingPlacePlaceholder: string;
  emptyTripStopsTitle: string;
  emptyTripStopsBody: string;
  emptyLegTitle: string;
  emptyLegBody: string;
  routeSearchSummary: string;
  mapHeading: string;
  mapSummary: string;
};

export function deriveTripPlanningCopy(stopCount: number, legCount: number): TripPlanningCopy {
  return {
    tripStopsHeading: tripStopsHeading(stopCount),
    tripStopsSummary:
      'Add Routing Places from the app-owned gazetteer. Adjacent Trip Stops automatically form current Legs for Route Search and route comparison.',
    routingPlacePlaceholder: 'Try a Routing Place, such as Denver, Colorado',
    emptyTripStopsTitle: 'No Trip Stops yet',
    emptyTripStopsBody: 'Add the first Routing Place for this Trip, then add another Trip Stop to create the first Leg.',
    emptyLegTitle: legCount === 0 && stopCount === 1 ? 'One more Trip Stop needed' : 'No Leg yet',
    emptyLegBody:
      stopCount === 1
        ? 'Add one more Trip Stop to derive the first current Leg for Route Search.'
        : 'Add at least two Trip Stops to derive the first current Leg for Route Search.',
    routeSearchSummary:
      'Compare provider-backed route geometry and generated Route Options for this current Leg. Choose the Directness that matches how far out of the way you are willing to go.',
    mapHeading: legCount > 0 ? 'Current Leg map context' : 'Trip map context',
    mapSummary:
      legCount > 0
        ? 'Maps show current Leg Route Options, Highlights, endpoints, and Shaping Stops when route context is available.'
        : 'Add Trip Stops and run a Route Search to show Route Options, Highlights, endpoints, and Shaping Stops on the map.'
  };
}

function tripStopsHeading(stopCount: number) {
  if (stopCount === 0) return 'Add Trip Stops';
  if (stopCount === 1) return 'Add another Trip Stop';
  return 'Manage Trip Stops';
}
