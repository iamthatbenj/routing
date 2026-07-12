import { describe, expect, it } from 'vitest';
import { MAX_ANCHOR_ROUTE_REQUESTS, selectRelevantAnchors, type AnchorCandidate } from './anchor-selection';
import type { RoutingPlace } from './routing-places';

const denver = place('denver-co', 'Denver', 39.7392, -104.9903);
const moab = place('moab-ut', 'Moab', 38.5733, -109.5498);
const boston = place('boston-ma', 'Boston', 42.35843, -71.05977);
const barHarbor = place('bar-harbor-me', 'Bar Harbor', 44.38758, -68.2039);

const candidates: AnchorCandidate[] = [
  anchor('colorado-national-monument', 'Colorado National Monument', 39.1008, -108.7335, 'nature', 82),
  anchor('black-canyon-of-the-gunnison', 'Black Canyon of the Gunnison', 38.5543, -107.6866, 'nature', 84),
  anchor('dinosaur-national-monument', 'Dinosaur National Monument', 40.507, -108.933, 'nature', 76),
  anchor('acadia-national-park-me', 'Acadia National Park', 44.3386, -68.2733, 'nature', 98),
  anchor('cadillac-mountain-me', 'Cadillac Mountain', 44.3512, -68.2258, 'nature', 94),
  anchor('park-loop-road-me', 'Park Loop Road', 44.329, -68.205, 'scenic_segment', 90),
  anchor('grafton-notch-state-park', 'Grafton Notch State Park', 44.593, -70.923, 'nature', 70)
];

describe('regional Anchor selection', () => {
  it('selects only relevant Denver to Moab Anchors and excludes Acadia Anchors', () => {
    const anchors = selectRelevantAnchors(denver, moab, candidates);

    expect(anchors.map((anchor) => anchor.name)).toEqual([
      'Black Canyon of the Gunnison',
      'Colorado National Monument',
      'Dinosaur National Monument'
    ]);
    expect(anchors.map((anchor) => anchor.name)).not.toContain('Acadia National Park');
  });

  it('selects only relevant Boston to Bar Harbor Anchors and excludes Colorado Anchors', () => {
    const anchors = selectRelevantAnchors(boston, barHarbor, candidates);

    expect(anchors.map((anchor) => anchor.name)).toEqual([
      'Acadia National Park',
      'Cadillac Mountain',
      'Park Loop Road'
    ]);
    expect(anchors.map((anchor) => anchor.name)).not.toContain('Colorado National Monument');
  });

  it('caps Anchor count deterministically for provider-backed requests', () => {
    const first = selectRelevantAnchors(boston, barHarbor, candidates);
    const second = selectRelevantAnchors(boston, barHarbor, candidates.toReversed());

    expect(first).toHaveLength(MAX_ANCHOR_ROUTE_REQUESTS);
    expect(second.map((anchor) => anchor.name)).toEqual(first.map((anchor) => anchor.name));
  });

  it('deduplicates same-name candidates from multiple source types', () => {
    const anchors = selectRelevantAnchors(boston, barHarbor, [
      anchor('acadia-highlight', 'Acadia National Park', 44.3386, -68.2733, 'nature', 98, 'highlight'),
      anchor('acadia-routing-place', 'Acadia National Park', 44.3386, -68.2733, 'national_park', 88, 'routing_place')
    ]);

    expect(anchors.map((selected) => selected.name)).toEqual(['Acadia National Park']);
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

function anchor(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  kind: string,
  strength: number,
  source: AnchorCandidate['source'] = 'highlight'
): AnchorCandidate {
  return { id, name, latitude, longitude, kind, strength, source };
}
