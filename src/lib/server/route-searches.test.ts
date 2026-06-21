import { describe, expect, it } from 'vitest';
import { OrsRouteError } from './ors';
import { routeSearchFailureMessage, tracerRouteAnchorLabels } from './route-searches';

describe('tracer Route Anchors', () => {
  it('includes a northern Dinosaur National Monument alternative for Denver to Moab', () => {
    expect(tracerRouteAnchorLabels).toContain('Dinosaur National Monument, Utah / Colorado');
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
