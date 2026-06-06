import type { SavedRoute } from './server/saved-routes';

export function googleMapsUrl(savedRoute: SavedRoute) {
  const origin = savedRoute.snapshot.endpoints.from;
  const destination = savedRoute.snapshot.endpoints.to;

  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
}

export function appleMapsUrl(savedRoute: SavedRoute) {
  const origin = savedRoute.snapshot.endpoints.from;
  const destination = savedRoute.snapshot.endpoints.to;

  return `https://maps.apple.com/?dirflg=d&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`;
}

export function routeGeometryWarning(savedRoute: SavedRoute) {
  const isFastest = savedRoute.snapshot.source === 'ors-fastest';

  return isFastest
    ? 'External navigation apps may still change the planned route because of traffic, closures, or app settings.'
    : 'This Saved Route was chosen for its Corridor. Google or Apple Maps may choose a different path unless later Shaping Stops are added.';
}
