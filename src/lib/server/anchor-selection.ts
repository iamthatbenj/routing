import type { Directness } from '$lib/directness-constraints';
import type { Highlight } from './highlights';
import type { RoutingPlace } from './routing-places';

export const MAX_ANCHOR_ROUTE_REQUESTS = 3;

export type AnchorCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: string;
  strength: number;
  source: 'highlight' | 'routing_place';
  endpointContextPlaceId?: string | null;
};

export type AnchorSelectionOptions = {
  directness?: Directness;
  maxAnchors?: number;
  maxDetourRatio?: number;
  boundingBoxPaddingDegrees?: number;
};

export function highlightToAnchorCandidate(highlight: Highlight): AnchorCandidate {
  return {
    id: highlight.id,
    name: highlight.name,
    latitude: highlight.latitude,
    longitude: highlight.longitude,
    kind: highlight.category,
    strength: highlight.strength,
    source: 'highlight',
    endpointContextPlaceId: highlight.endpointContextPlaceId
  };
}

export function routingPlaceToAnchorCandidate(place: RoutingPlace): AnchorCandidate {
  return {
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    kind: place.kind,
    strength: routingPlaceAnchorStrength(place),
    source: 'routing_place'
  };
}

export function selectRelevantAnchors(
  from: RoutingPlace,
  to: RoutingPlace,
  candidates: AnchorCandidate[],
  {
    directness = 'Balanced',
    maxAnchors = MAX_ANCHOR_ROUTE_REQUESTS,
    maxDetourRatio = anchorPolicyForDirectness(directness).maxDetourRatio,
    boundingBoxPaddingDegrees = anchorPolicyForDirectness(directness).boundingBoxPaddingDegrees
  }: AnchorSelectionOptions = {}
) {
  const directDistance = approximateDistanceMeters(from, to);
  const seenNames = new Set<string>();

  return candidates
    .filter((candidate) => candidate.id !== from.id && candidate.id !== to.id)
    .filter((candidate) => candidate.endpointContextPlaceId !== from.id && candidate.endpointContextPlaceId !== to.id)
    .filter((candidate) => isInsideExpandedEndpointBounds(candidate, from, to, boundingBoxPaddingDegrees))
    .map((candidate) => ({
      candidate,
      detourRatio: directDistance > 0 ? detourDistanceMeters(from, candidate, to) / directDistance : Infinity
    }))
    .filter(({ detourRatio }) => detourRatio <= maxDetourRatio)
    .sort((left, right) => compareAnchors(left, right, directness))
    .filter(({ candidate }) => {
      const key = candidate.name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .slice(0, maxAnchors)
    .map(({ candidate }) => candidateToRoutingPlace(candidate));
}

function candidateToRoutingPlace(candidate: AnchorCandidate): RoutingPlace {
  return {
    id: candidate.id,
    name: candidate.name,
    region: candidate.source === 'highlight' ? 'Highlight' : 'Routing Place',
    kind: candidate.kind,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    searchLabel: candidate.name
  };
}

function isInsideExpandedEndpointBounds(
  candidate: AnchorCandidate,
  from: RoutingPlace,
  to: RoutingPlace,
  paddingDegrees: number
) {
  const minLatitude = Math.min(from.latitude, to.latitude) - paddingDegrees;
  const maxLatitude = Math.max(from.latitude, to.latitude) + paddingDegrees;
  const minLongitude = Math.min(from.longitude, to.longitude) - paddingDegrees;
  const maxLongitude = Math.max(from.longitude, to.longitude) + paddingDegrees;

  return (
    candidate.latitude >= minLatitude &&
    candidate.latitude <= maxLatitude &&
    candidate.longitude >= minLongitude &&
    candidate.longitude <= maxLongitude
  );
}

function detourDistanceMeters(from: RoutingPlace, via: AnchorCandidate, to: RoutingPlace) {
  return approximateDistanceMeters(from, via) + approximateDistanceMeters(via, to);
}

function compareAnchors(
  left: { candidate: AnchorCandidate; detourRatio: number },
  right: { candidate: AnchorCandidate; detourRatio: number },
  directness: Directness
) {
  if (directness === 'Direct') {
    return (
      left.detourRatio - right.detourRatio ||
      right.candidate.strength - left.candidate.strength ||
      left.candidate.name.localeCompare(right.candidate.name)
    );
  }

  return (
    right.candidate.strength - left.candidate.strength ||
    left.detourRatio - right.detourRatio ||
    left.candidate.name.localeCompare(right.candidate.name)
  );
}

function anchorPolicyForDirectness(directness: Directness) {
  if (directness === 'Direct') return { maxDetourRatio: 1.18, boundingBoxPaddingDegrees: 0.75 };
  if (directness === 'Adventurous') return { maxDetourRatio: 2.35, boundingBoxPaddingDegrees: 2.5 };
  return { maxDetourRatio: 1.75, boundingBoxPaddingDegrees: 1.25 };
}

function routingPlaceAnchorStrength(place: RoutingPlace) {
  if (place.kind === 'national_park') return 88;
  if (place.kind === 'national_monument') return 78;
  return 55;
}

function approximateDistanceMeters(
  from: Pick<RoutingPlace, 'latitude' | 'longitude'>,
  to: Pick<RoutingPlace, 'latitude' | 'longitude'>
) {
  const earthRadiusMeters = 6_371_000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
