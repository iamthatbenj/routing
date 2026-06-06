import { env } from '$env/dynamic/private';
import type { RoutingPlace } from './routing-places';

export type OrsRoute = {
  name: string;
  source: string;
  durationSeconds: number;
  distanceMeters: number;
  geometry: unknown;
};

type OrsFeature = {
  type: 'Feature';
  geometry: unknown;
  properties?: {
    summary?: {
      duration?: number;
      distance?: number;
    };
  };
};

type OrsResponse = {
  type: 'FeatureCollection';
  features?: OrsFeature[];
};

const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

export async function fetchDrivingRoutes({
  from,
  to,
  via
}: {
  from: RoutingPlace;
  to: RoutingPlace;
  via?: RoutingPlace;
}): Promise<OrsRoute[]> {
  const apiKey = env.ORS_API_KEY ?? env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing ORS_API_KEY. Add an OpenRouteService API key to run Route Searches.');
  }

  const coordinates = via
    ? [toCoordinate(from), toCoordinate(via), toCoordinate(to)]
    : [toCoordinate(from), toCoordinate(to)];

  const body: Record<string, unknown> = {
    coordinates,
    instructions: false,
    preference: 'recommended'
  };

  if (!via && approximateDistanceMeters(from, to) <= 100_000) {
    body.alternative_routes = {
      target_count: 2,
      share_factor: 0.6,
      weight_factor: 1.6
    };
  }

  const response = await fetch(orsUrl, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouteService request failed (${response.status}): ${message.slice(0, 240)}`);
  }

  const json = (await response.json()) as OrsResponse;
  const features = json.features ?? [];

  if (features.length === 0) {
    throw new Error('OpenRouteService returned no Route Options.');
  }

  return features.map((feature, index) => {
    const summary = feature.properties?.summary;

    if (!summary?.duration || !summary.distance) {
      throw new Error('OpenRouteService returned a Route Option without duration or distance.');
    }

    const label = via
      ? `Via ${via.name}`
      : index === 0
        ? 'Fastest baseline'
        : `ORS alternative ${index + 1}`;

    return {
      name: label,
      source: via ? 'ors-anchor' : index === 0 ? 'ors-fastest' : 'ors-alternative',
      durationSeconds: Math.round(summary.duration),
      distanceMeters: Math.round(summary.distance),
      geometry: feature.geometry
    };
  });
}

function toCoordinate(place: RoutingPlace) {
  return [place.longitude, place.latitude];
}

function approximateDistanceMeters(from: RoutingPlace, to: RoutingPlace) {
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
