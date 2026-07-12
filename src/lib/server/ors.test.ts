import { describe, expect, it } from 'vitest';
import { buildOrsDirectionsBody } from './ors';
import type { RoutingPlace } from './routing-places';

const boston = place('boston-ma', 'Boston', 42.35843, -71.05977);
const barHarbor = place('bar-harbor-me', 'Bar Harbor', 44.38758, -68.2039);
const acadia = place('acadia-national-park-me', 'Acadia National Park', 44.3386, -68.2733);

describe('ORS request construction', () => {
  it('builds a Boston to Bar Harbor fastest-baseline request without live provider credentials', () => {
    expect(buildOrsDirectionsBody({ from: boston, to: barHarbor })).toEqual({
      coordinates: [
        [-71.05977, 42.35843],
        [-68.2039, 44.38758]
      ],
      instructions: false,
      preference: 'recommended'
    });
  });

  it('builds an Anchor request through a regional Highlight without direct-route alternatives', () => {
    expect(buildOrsDirectionsBody({ from: boston, to: barHarbor, via: acadia })).toEqual({
      coordinates: [
        [-71.05977, 42.35843],
        [-68.2733, 44.3386],
        [-68.2039, 44.38758]
      ],
      instructions: false,
      preference: 'recommended'
    });
  });
});

function place(id: string, name: string, latitude: number, longitude: number): RoutingPlace {
  return {
    id,
    name,
    region: 'Test',
    kind: 'city',
    latitude,
    longitude,
    searchLabel: name
  };
}
