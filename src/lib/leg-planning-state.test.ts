import { describe, expect, it } from 'vitest';
import { deriveLegPlanningState, type LegPlanningStateInput } from './leg-planning-state';

describe('deriveLegPlanningState', () => {
  it('invites a Route Search when a current Leg has no Route Search', () => {
    expect(deriveLegPlanningState(leg()).kind).toBe('needs_route_search');
    expect(deriveLegPlanningState(leg()).action).toContain('Run a Route Search');
  });

  it('invites saving a Route Option when options exist but no Saved Route exists', () => {
    const state = deriveLegPlanningState(leg({ routeSearch: routeSearch([{ source: 'ors-fastest' }, { source: 'ors-anchor' }]) }));

    expect(state.kind).toBe('choose_route_option');
    expect(state.summary).toContain('Route Options');
    expect(state.action).toContain('Save a Route Option');
  });

  it('invites choosing a Preferred Saved Route when Saved Routes exist without a preference', () => {
    const state = deriveLegPlanningState(
      leg({
        routeSearch: routeSearch([{ source: 'ors-fastest' }]),
        savedRoutes: [{ isPreferred: false }]
      })
    );

    expect(state.kind).toBe('choose_preferred_saved_route');
    expect(state.action).toContain('Preferred Saved Route');
  });

  it('surfaces Leg Handoff when a Preferred Saved Route exists', () => {
    const state = deriveLegPlanningState(
      leg({
        routeSearch: routeSearch([{ source: 'ors-fastest' }]),
        savedRoutes: [{ isPreferred: true }]
      })
    );

    expect(state.kind).toBe('ready_for_handoff');
    expect(state.summary).toContain('Leg Handoff');
  });

  it('distinguishes fallback Corridors from saveable provider-backed Route Options', () => {
    const state = deriveLegPlanningState(
      leg({ routeSearch: routeSearch([{ source: 'fallback-direct' }, { source: 'fallback-anchor' }]) })
    );

    expect(state.kind).toBe('fallback_corridors_only');
    expect(state.summary).toContain('fallback Corridors');
  });

  it('communicates failed Route Searches separately from missing Route Searches', () => {
    const state = deriveLegPlanningState(leg({ routeSearch: routeSearch([], 'failed') }));

    expect(state.kind).toBe('route_search_failed');
    expect(state.action).toContain('try comparing Route Options again');
  });
});

function leg(overrides: Partial<LegPlanningStateInput> = {}): LegPlanningStateInput {
  return {
    routeSearch: null,
    savedRoutes: [],
    ...overrides
  };
}

function routeSearch(options: Array<{ source: string }>, status = 'complete'): NonNullable<LegPlanningStateInput['routeSearch']> {
  return {
    status,
    options,
    diagnostics: { usedFallback: false }
  };
}
