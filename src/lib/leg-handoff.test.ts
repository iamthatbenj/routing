import { describe, expect, it } from 'vitest';
import { googleMapsUrl, routeGeometryWarning } from './leg-handoff';
import type { SavedRoute } from './server/saved-routes';

function savedRoute(overrides: Partial<SavedRoute['snapshot']> = {}): SavedRoute {
  return {
    id: 'saved-route',
    tripId: 'trip',
    fromTripStopId: 'from',
    toTripStopId: 'to',
    routeOptionId: 'option',
    title: 'Via Colorado National Monument',
    isPreferred: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    snapshot: {
      routeOptionId: 'option',
      name: 'Via Colorado National Monument',
      source: 'ors-anchor',
      endpoints: {
        from: 'Denver, Colorado',
        to: 'Moab, Utah'
      },
      directness: 'Balanced',
      durationSeconds: 1,
      distanceMeters: 1,
      geometryJson: '{}',
      interestScore: 10,
      explanations: [],
      reasons: [],
      fastestBaselineDeltaSeconds: 1,
      warnings: [],
      handoffStops: [],
      ...overrides
    }
  };
}

describe('Leg Handoff links', () => {
  it('includes Shaping Stops as Google Maps waypoints', () => {
    const url = googleMapsUrl(
      savedRoute({
        handoffStops: [{ label: 'Colorado National Monument, Colorado' }]
      })
    );

    const params = new URL(url).searchParams;

    expect(params.get('origin')).toBe('Denver, Colorado');
    expect(params.get('destination')).toBe('Moab, Utah');
    expect(params.get('waypoints')).toBe('Colorado National Monument, Colorado');
  });

  it('warns when a Saved Route depends on Shaping Stops', () => {
    expect(
      routeGeometryWarning(
        savedRoute({
          handoffStops: [{ label: 'Colorado National Monument, Colorado' }]
        })
      )
    ).toContain('Shaping Stops');
  });
});
