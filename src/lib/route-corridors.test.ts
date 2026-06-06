import { describe, expect, it } from 'vitest';
import { corridorOverlap, selectCorridorRouteOptions, type LineStringGeometry } from './route-corridors';

function line(points: [number, number][]): LineStringGeometry {
  return { type: 'LineString', coordinates: points };
}

function candidate({
  name,
  source = 'ors-anchor',
  score,
  duration,
  geometry
}: {
  name: string;
  source?: string;
  score: number;
  duration: number;
  geometry: LineStringGeometry;
}) {
  return {
    name,
    source,
    interestScore: score,
    durationSeconds: duration,
    distanceMeters: duration * 20,
    geometry
  };
}

describe('corridor selection', () => {
  it('keeps the fastest baseline and removes duplicate alternatives from the same Corridor', () => {
    const fastest = candidate({
      name: 'Fastest baseline',
      source: 'ors-fastest',
      score: 40,
      duration: 100,
      geometry: line([
        [-105, 39],
        [-106, 39],
        [-107, 39]
      ])
    });
    const bestNorthern = candidate({
      name: 'Northern parks',
      score: 90,
      duration: 130,
      geometry: line([
        [-105, 40],
        [-106, 40],
        [-107, 40]
      ])
    });
    const duplicateNorthern = candidate({
      name: 'Northern parks minor variant',
      score: 85,
      duration: 128,
      geometry: line([
        [-105.01, 40.01],
        [-106.01, 40.01],
        [-107.01, 40.01]
      ])
    });
    const southern = candidate({
      name: 'Southern canyon',
      score: 70,
      duration: 150,
      geometry: line([
        [-105, 38],
        [-106, 38],
        [-107, 38]
      ])
    });

    const selected = selectCorridorRouteOptions([fastest, bestNorthern, duplicateNorthern, southern]);

    expect(selected.map((route) => route.name)).toEqual([
      'Fastest baseline',
      'Northern parks',
      'Southern canyon'
    ]);
  });

  it('still presents a choice when every alternative overlaps the same Corridor', () => {
    const fastest = candidate({
      name: 'Fastest baseline',
      source: 'ors-fastest',
      score: 20,
      duration: 100,
      geometry: line([
        [-105, 39],
        [-106, 39],
        [-107, 39]
      ])
    });
    const overlappingAlternative = candidate({
      name: 'Small interesting detour',
      score: 60,
      duration: 112,
      geometry: line([
        [-105.01, 39.01],
        [-106.01, 39.01],
        [-107.01, 39.01]
      ])
    });
    const lowerScoringOverlap = candidate({
      name: 'Less useful duplicate',
      score: 40,
      duration: 110,
      geometry: line([
        [-105.01, 39.01],
        [-106.01, 39.01],
        [-107.01, 39.01]
      ])
    });

    const selected = selectCorridorRouteOptions([fastest, overlappingAlternative, lowerScoringOverlap]);

    expect(selected.map((route) => route.name)).toEqual(['Fastest baseline', 'Small interesting detour']);
  });

  it('measures overlapping Corridors from route geometry cells', () => {
    const first = line([
      [-105, 39],
      [-106, 39],
      [-107, 39]
    ]);
    const nearby = line([
      [-105.01, 39.01],
      [-106.01, 39.01],
      [-107.01, 39.01]
    ]);
    const farAway = line([
      [-105, 35],
      [-106, 35],
      [-107, 35]
    ]);

    expect(corridorOverlap(first, nearby)).toBeGreaterThan(0.7);
    expect(corridorOverlap(first, farAway)).toBeLessThan(0.2);
  });
});
