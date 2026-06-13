import { describe, expect, it } from 'vitest';
import { shapingStopsFromGeometry } from './shaping-stops';

function lineString(coordinates: [number, number][]) {
  return JSON.stringify({ type: 'LineString', coordinates });
}

describe('shaping stop generation', () => {
  it('generates ordered route-coordinate waypoints away from endpoints', () => {
    const stops = shapingStopsFromGeometry(
      lineString([
        [-105, 39],
        [-106, 39.2],
        [-107, 39.4],
        [-108, 39.6],
        [-109, 39.8]
      ])
    );

    expect(stops).toHaveLength(5);
    expect(stops.map((stop) => stop.routeFraction)).toEqual([0.18, 0.34, 0.5, 0.66, 0.82]);
    expect(stops[0]?.label).toMatch(/^39\.1\d+,\-105\.7\d+$/);
    expect(stops[0]?.displayLabel).toBe('Shaping Stop 1 (18% along route)');
    expect(stops.every((stop) => stop.routeFraction > 0.15 && stop.routeFraction < 0.85)).toBe(true);
  });

  it('caps Google Maps shaping stops at five even when asked for more', () => {
    const stops = shapingStopsFromGeometry(
      lineString([
        [-105, 39],
        [-106, 39.2],
        [-107, 39.4],
        [-108, 39.6],
        [-109, 39.8]
      ]),
      { maxStops: 12 }
    );

    expect(stops).toHaveLength(5);
  });

  it('does not create shaping stops for short routes', () => {
    const stops = shapingStopsFromGeometry(
      lineString([
        [-105, 39],
        [-105.1, 39.02]
      ])
    );

    expect(stops).toEqual([]);
  });
});
