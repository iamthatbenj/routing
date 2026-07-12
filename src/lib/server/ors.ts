import { env } from '$env/dynamic/private';
import type { RoutingPlace } from './routing-places';

export type OrsFailureCategory = 'missing_config' | 'auth' | 'quota' | 'no_route' | 'provider' | 'network' | 'malformed_response';

export class OrsRouteError extends Error {
  category: OrsFailureCategory;
  status?: number;
  diagnosticMessage: string;

  constructor(category: OrsFailureCategory, message: string, { status, diagnosticMessage = message }: { status?: number; diagnosticMessage?: string } = {}) {
    super(message);
    this.name = 'OrsRouteError';
    this.category = category;
    this.status = status;
    this.diagnosticMessage = diagnosticMessage;
  }
}

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
    throw new OrsRouteError(
      'missing_config',
      'Route Search is not configured yet. Add an OpenRouteService API key before running provider-backed Route Searches.'
    );
  }

  const body = buildOrsDirectionsBody({ from, to, via });

  let response: Response;

  try {
    response = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new OrsRouteError('network', 'Route Search provider could not be reached. Try again in a few minutes.', {
      diagnosticMessage: error instanceof Error ? error.message : 'Fetch failed before receiving a provider response.'
    });
  }

  if (!response.ok) {
    const message = await response.text();
    throw new OrsRouteError(categoryForStatus(response.status), messageForStatus(response.status), {
      status: response.status,
      diagnosticMessage: `OpenRouteService request failed (${response.status}): ${message.slice(0, 240)}`
    });
  }

  let json: OrsResponse;

  try {
    json = (await response.json()) as OrsResponse;
  } catch (error) {
    throw new OrsRouteError('malformed_response', 'Route Search provider returned an unreadable response. Try again later.', {
      diagnosticMessage: error instanceof Error ? error.message : 'Provider response was not valid JSON.'
    });
  }
  const features = json.features ?? [];

  if (features.length === 0) {
    throw new OrsRouteError('no_route', 'No provider-backed Route Option was found for this Leg. Try different Trip Stops or try again later.');
  }

  return features.map((feature, index) => {
    const summary = feature.properties?.summary;

    if (!summary?.duration || !summary.distance) {
      throw new OrsRouteError('malformed_response', 'Route Search provider returned an incomplete Route Option. Try again later.');
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

export function buildOrsDirectionsBody({
  from,
  to,
  via
}: {
  from: RoutingPlace;
  to: RoutingPlace;
  via?: RoutingPlace;
}) {
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

  return body;
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

function categoryForStatus(status: number): OrsFailureCategory {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'quota';
  return 'provider';
}

function messageForStatus(status: number) {
  if (status === 401 || status === 403) {
    return 'Route Search provider rejected the configured API key. Check the OpenRouteService key before trying again.';
  }

  if (status === 429) {
    return 'Route Search provider quota or rate limit was reached. Try again later.';
  }

  return 'Route Search provider returned an error. Try again later.';
}
