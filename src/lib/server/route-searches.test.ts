import { describe, expect, it } from 'vitest';
import { tracerRouteAnchorLabels } from './route-searches';

describe('tracer Route Anchors', () => {
  it('includes a northern Dinosaur National Monument alternative for Denver to Moab', () => {
    expect(tracerRouteAnchorLabels).toContain('Dinosaur National Monument, Utah / Colorado');
  });
});
