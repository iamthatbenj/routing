export type LineStringGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type GeneratedShapingStop = {
  label: string;
  displayLabel: string;
  latitude: number;
  longitude: number;
  routeFraction: number;
};

const maxShapingStops = 5;
const endpointBufferFraction = 0.15;
const preferredFractions = [0.18, 0.34, 0.5, 0.66, 0.82];
const minimumRouteMetersForStops = 80_000;

export function shapingStopsFromGeometry(geometryJson: string, options: { maxStops?: number } = {}): GeneratedShapingStop[] {
  const geometry = parseLineString(geometryJson);
  if (!geometry || geometry.coordinates.length < 2) return [];

  const cumulative = cumulativeDistances(geometry.coordinates);
  const totalMeters = cumulative.at(-1) ?? 0;
  if (totalMeters < minimumRouteMetersForStops) return [];

  const stopCount = Math.max(0, Math.min(options.maxStops ?? maxShapingStops, maxShapingStops));
  return preferredFractions
    .slice(0, stopCount)
    .map((fraction, index) => interpolateAtFraction(geometry.coordinates, cumulative, fraction))
    .filter((stop): stop is { coordinate: [number, number]; routeFraction: number } => Boolean(stop))
    .filter((stop) => stop.routeFraction >= endpointBufferFraction && stop.routeFraction <= 1 - endpointBufferFraction)
    .map(({ coordinate, routeFraction }, index) => {
      const [longitude, latitude] = coordinate;
      return {
        label: coordinateLabel(latitude, longitude),
        displayLabel: `Shaping Stop ${index + 1} (${Math.round(routeFraction * 100)}% along route)`,
        latitude,
        longitude,
        routeFraction
      };
    });
}

function parseLineString(value: string): LineStringGeometry | null {
  try {
    const geometry = JSON.parse(value) as LineStringGeometry;
    if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
    const validCoordinates = geometry.coordinates.every(
      (coordinate) =>
        Array.isArray(coordinate) &&
        coordinate.length === 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1])
    );
    return validCoordinates ? geometry : null;
  } catch {
    return null;
  }
}

function cumulativeDistances(coordinates: [number, number][]) {
  const distances = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    distances.push(distances[index - 1] + distanceMeters(coordinates[index - 1], coordinates[index]));
  }
  return distances;
}

function interpolateAtFraction(coordinates: [number, number][], cumulative: number[], fraction: number) {
  const totalMeters = cumulative.at(-1) ?? 0;
  const targetMeters = totalMeters * fraction;

  for (let index = 1; index < cumulative.length; index += 1) {
    if (cumulative[index] < targetMeters) continue;

    const segmentStartMeters = cumulative[index - 1];
    const segmentEndMeters = cumulative[index];
    const segmentFraction = segmentEndMeters === segmentStartMeters ? 0 : (targetMeters - segmentStartMeters) / (segmentEndMeters - segmentStartMeters);
    const start = coordinates[index - 1];
    const end = coordinates[index];

    return {
      coordinate: [start[0] + (end[0] - start[0]) * segmentFraction, start[1] + (end[1] - start[1]) * segmentFraction] as [number, number],
      routeFraction: fraction
    };
  }

  return null;
}

function distanceMeters(from: [number, number], to: [number, number]) {
  const earthRadiusMeters = 6_371_000;
  const fromLat = radians(from[1]);
  const toLat = radians(to[1]);
  const deltaLat = radians(to[1] - from[1]);
  const deltaLon = radians(to[0] - from[0]);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function coordinateLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}
