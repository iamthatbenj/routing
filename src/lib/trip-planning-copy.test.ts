import { describe, expect, it } from 'vitest';
import { deriveTripPlanningCopy } from './trip-planning-copy';

describe('deriveTripPlanningCopy', () => {
  it('uses geography-neutral copy for an empty Trip', () => {
    const copy = deriveTripPlanningCopy(0, 0);

    expect(copy.tripStopsHeading).toBe('Add Trip Stops');
    expect(copy.emptyTripStopsBody).toContain('first Routing Place');
    expect(copy.emptyTripStopsBody).not.toContain('Denver');
    expect(copy.emptyTripStopsBody).not.toContain('Moab');
    expect(copy.emptyLegBody).toContain('at least two Trip Stops');
  });

  it('explains the one-stop state without naming a fixed route', () => {
    const copy = deriveTripPlanningCopy(1, 0);

    expect(copy.tripStopsHeading).toBe('Add another Trip Stop');
    expect(copy.emptyLegTitle).toBe('One more Trip Stop needed');
    expect(copy.emptyLegBody).toContain('first current Leg');
    expect(copy.emptyLegBody).not.toContain('Denver');
    expect(copy.emptyLegBody).not.toContain('Moab');
  });

  it('uses current-Leg copy for multi-Leg Trips', () => {
    const copy = deriveTripPlanningCopy(3, 2);

    expect(copy.tripStopsHeading).toBe('Manage Trip Stops');
    expect(copy.routeSearchSummary).toContain('this current Leg');
    expect(copy.routeSearchSummary).toContain('Directness');
    expect(copy.mapHeading).toBe('Current Leg map context');
  });

  it('allows Denver as an example placeholder without making it the required Trip', () => {
    const copy = deriveTripPlanningCopy(0, 0);

    expect(copy.routingPlacePlaceholder).toBe('Try a Routing Place, such as Denver, Colorado');
  });
});
