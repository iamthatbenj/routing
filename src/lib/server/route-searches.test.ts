import { describe, expect, it } from 'vitest';
import { OrsRouteError } from './ors';
import { fallbackRoute, failureDiagnostics, routeSearchFailureMessage, successDiagnostics, tracerRouteAnchorLabels } from './route-searches';
import type { RoutingPlace } from './routing-places';

describe('tracer Route Anchors', () => {
  it('includes a northern Dinosaur National Monument alternative for Denver to Moab', () => {
    expect(tracerRouteAnchorLabels).toContain('Dinosaur National Monument, Utah / Colorado');
  });
});

describe('fallback Route Options', () => {
  const denver: RoutingPlace = {
    id: 'denver',
    name: 'Denver',
    region: 'Colorado',
    kind: 'city',
    latitude: 39.7392,
    longitude: -104.9903,
    searchLabel: 'Denver, Colorado'
  };
  const moab: RoutingPlace = {
    id: 'moab',
    name: 'Moab',
    region: 'Utah',
    kind: 'city',
    latitude: 38.5733,
    longitude: -109.5498,
    searchLabel: 'Moab, Utah'
  };
  const anchor: RoutingPlace = {
    id: 'dinosaur',
    name: 'Dinosaur National Monument',
    region: 'Utah / Colorado',
    kind: 'anchor',
    latitude: 40.4372,
    longitude: -109.3046,
    searchLabel: 'Dinosaur National Monument, Utah / Colorado'
  };

  it('creates approximate direct fallback geometry without provider routing', () => {
    const route = fallbackRoute({ from: denver, to: moab });

    expect(route.source).toBe('fallback-direct');
    expect(route.name).toBe('Approximate direct Corridor');
    expect(route.geometry).toMatchObject({
      type: 'LineString',
      coordinates: [
        [denver.longitude, denver.latitude],
        [moab.longitude, moab.latitude]
      ]
    });
    expect(route.durationSeconds).toBeGreaterThan(0);
    expect(route.distanceMeters).toBeGreaterThan(0);
  });

  it('creates approximate Anchor fallback geometry through the Anchor', () => {
    const route = fallbackRoute({ from: denver, to: moab, via: anchor });

    expect(route.source).toBe('fallback-anchor');
    expect(route.name).toBe('Approximate via Dinosaur National Monument');
    expect(route.geometry).toMatchObject({
      type: 'LineString',
      coordinates: [
        [denver.longitude, denver.latitude],
        [anchor.longitude, anchor.latitude],
        [moab.longitude, moab.latitude]
      ]
    });
  });
});

describe('Route Search diagnostics', () => {
  it('captures successful provider sources without sensitive details', () => {
    const diagnostics = successDiagnostics([{ source: 'ors-fastest' }, { source: 'ors-anchor' }, { source: 'ors-anchor' }]);

    expect(diagnostics).toEqual({
      provider: 'ors',
      outcome: 'complete',
      routeSources: ['ors-fastest', 'ors-anchor'],
      optionCount: 3,
      usedFallback: false
    });
  });

  it('captures fallback outcome and provider error category', () => {
    const diagnostics = successDiagnostics(
      [{ source: 'fallback-direct' }, { source: 'fallback-anchor' }],
      new OrsRouteError('quota', 'Quota reached', { status: 429, diagnosticMessage: 'raw provider body' })
    );

    expect(diagnostics).toEqual({
      provider: 'ors',
      outcome: 'fallback_complete',
      routeSources: ['fallback-direct', 'fallback-anchor'],
      optionCount: 2,
      usedFallback: true,
      errorCategory: 'quota',
      errorStatus: 429
    });
    expect(JSON.stringify(diagnostics)).not.toContain('raw provider body');
  });

  it('captures failed provider diagnostics without raw messages', () => {
    const diagnostics = failureDiagnostics(
      new OrsRouteError('auth', 'Provider rejected key', { status: 403, diagnosticMessage: 'secret-ish provider body' })
    );

    expect(diagnostics).toMatchObject({
      provider: 'ors',
      outcome: 'failed',
      errorCategory: 'auth',
      errorStatus: 403
    });
    expect(JSON.stringify(diagnostics)).not.toContain('secret-ish provider body');
  });
});

describe('Route Search failure messages', () => {
  it('passes through categorized provider messages for users', () => {
    const message = routeSearchFailureMessage(
      new OrsRouteError('quota', 'Route Search provider quota or rate limit was reached. Try again later.', {
        status: 429,
        diagnosticMessage: 'OpenRouteService request failed (429): raw provider body'
      })
    );

    expect(message).toBe('Route Search provider quota or rate limit was reached. Try again later.');
    expect(message).not.toContain('raw provider body');
  });

  it('hides unexpected internals behind a generic user message', () => {
    const message = routeSearchFailureMessage(new Error('SQLITE_ERROR: table route_options exploded'));

    expect(message).toBe('Route Search failed before Route Options could be created. Try again later.');
    expect(message).not.toContain('SQLITE_ERROR');
  });
});
