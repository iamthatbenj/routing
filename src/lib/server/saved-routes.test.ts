import { describe, expect, it } from 'vitest';
import { listSavedRoutesForLeg, savedRouteBelongsToCurrentLeg } from './saved-routes';
import type { SavedRoute } from './saved-routes';
import type { Leg, TripStop } from './trip-stops';

const stopA = tripStop('stop-a');
const stopB = tripStop('stop-b');
const stopC = tripStop('stop-c');

const savedRouteAB = savedRoute('route-ab', 'stop-a', 'stop-b', true);
const savedRouteBC = savedRoute('route-bc', 'stop-b', 'stop-c', true);
const savedRouteAC = savedRoute('route-ac', 'stop-a', 'stop-c', true);

describe('current Leg Saved Route guards', () => {
  it('keeps a Saved Route on its original current Leg before Trip Stop changes', () => {
    const legs = [leg(stopA, stopB), leg(stopB, stopC)];

    expect(savedRouteBelongsToCurrentLeg(savedRouteAB, legs)).toBe(true);
    expect(listSavedRoutesForLeg([savedRouteAB, savedRouteBC, savedRouteAC], legs[0])).toEqual([savedRouteAB]);
  });

  it('does not show stale Saved Routes on different Legs after Trip Stop reordering', () => {
    const reorderedLegs = [leg(stopB, stopA), leg(stopA, stopC)];

    expect(savedRouteBelongsToCurrentLeg(savedRouteAB, reorderedLegs)).toBe(false);
    expect(listSavedRoutesForLeg([savedRouteAB, savedRouteBC, savedRouteAC], reorderedLegs[0])).toEqual([]);
    expect(listSavedRoutesForLeg([savedRouteAB, savedRouteBC, savedRouteAC], reorderedLegs[1])).toEqual([savedRouteAC]);
  });

  it('does not show Saved Routes from deleted Trip Stop pairs as current Leg choices', () => {
    const legsAfterDeletingMiddleStop = [leg(stopA, stopC)];

    expect(savedRouteBelongsToCurrentLeg(savedRouteAB, legsAfterDeletingMiddleStop)).toBe(false);
    expect(savedRouteBelongsToCurrentLeg(savedRouteBC, legsAfterDeletingMiddleStop)).toBe(false);
    expect(listSavedRoutesForLeg([savedRouteAB, savedRouteBC], legsAfterDeletingMiddleStop[0])).toEqual([]);
  });
});

function tripStop(id: string): TripStop {
  return {
    id,
    tripId: 'trip-1',
    position: 1,
    details: '',
    routingPlace: {
      id: `place-${id}`,
      name: id,
      region: 'Test',
      kind: 'city',
      latitude: 0,
      longitude: 0,
      searchLabel: `${id}, Test`
    }
  };
}

function leg(from: TripStop, to: TripStop): Leg {
  return {
    id: `${from.id}-${to.id}`,
    from,
    to
  };
}

function savedRoute(id: string, fromTripStopId: string, toTripStopId: string, isPreferred: boolean): SavedRoute {
  return {
    id,
    tripId: 'trip-1',
    fromTripStopId,
    toTripStopId,
    routeOptionId: `option-${id}`,
    title: id,
    isPreferred,
    snapshot: {
      routeOptionId: `option-${id}`,
      name: id,
      source: 'ors-fastest',
      endpoints: {
        from: 'A, Test',
        to: 'B, Test'
      },
      directness: 'Balanced',
      durationSeconds: 1,
      distanceMeters: 1,
      geometryJson: '{"type":"LineString","coordinates":[]}',
      interestScore: 0,
      explanations: [],
      reasons: [],
      directnessConstraint: {
        status: 'normal',
        directness: 'Balanced',
        extraSeconds: 0,
        extraRatio: 0,
        normalLimitSeconds: 0,
        constrainedLimitSeconds: 0,
        reason: ''
      },
      fastestBaselineDeltaSeconds: 0,
      warnings: [],
      handoffStops: []
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}
