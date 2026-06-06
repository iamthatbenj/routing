import { gridDisk, latLngToCell } from 'h3-js';

export type LineStringGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type CorridorCandidate = {
  source: string;
  durationSeconds: number;
  distanceMeters: number;
  interestScore: number;
  geometry: unknown;
};

export function routeCorridorCells(geometry: unknown, resolution = 5) {
  const line = geometry as LineStringGeometry;
  if (line.type !== 'LineString' || !Array.isArray(line.coordinates)) return [];

  const cells = new Set<string>();
  const sampleEvery = Math.max(1, Math.floor(line.coordinates.length / 120));

  line.coordinates.forEach(([longitude, latitude], index) => {
    if (index % sampleEvery !== 0 && index !== line.coordinates.length - 1) return;
    for (const cell of gridDisk(latLngToCell(latitude, longitude, resolution), 1)) {
      cells.add(cell);
    }
  });

  return [...cells];
}

export function corridorOverlap(firstGeometry: unknown, secondGeometry: unknown) {
  const first = new Set(routeCorridorCells(firstGeometry));
  const second = new Set(routeCorridorCells(secondGeometry));

  if (first.size === 0 || second.size === 0) return 0;

  let intersection = 0;
  for (const cell of first) {
    if (second.has(cell)) intersection += 1;
  }

  const smallerCorridor = Math.min(first.size, second.size);
  return intersection / smallerCorridor;
}

export function selectCorridorRouteOptions<T extends CorridorCandidate>(
  candidates: T[],
  { maxOptions = 3, duplicateThreshold = 0.72 } = {}
) {
  if (candidates.length <= 1) return candidates;

  const fastest = findFastestBaseline(candidates);
  const alternatives = candidates
    .filter((candidate) => candidate !== fastest)
    .sort((left, right) => right.interestScore - left.interestScore || left.durationSeconds - right.durationSeconds);

  const selected = fastest ? [fastest] : [];
  const selectedAlternatives: T[] = [];

  for (const alternative of alternatives) {
    if (selected.length >= maxOptions) break;

    const duplicatesExistingAlternative = selectedAlternatives.some(
      (selectedAlternative) => corridorOverlap(alternative.geometry, selectedAlternative.geometry) >= duplicateThreshold
    );

    if (!duplicatesExistingAlternative) {
      selected.push(alternative);
      selectedAlternatives.push(alternative);
    }
  }

  if (selected.length === 1 && alternatives[0]) {
    selected.push(alternatives[0]);
  }

  return selected;
}

function findFastestBaseline<T extends CorridorCandidate>(candidates: T[]) {
  return (
    candidates.find((candidate) => candidate.source === 'ors-fastest') ??
    candidates.toSorted((left, right) => left.durationSeconds - right.durationSeconds)[0]
  );
}
