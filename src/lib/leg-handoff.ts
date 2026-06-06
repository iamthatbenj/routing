import type { SavedRoute } from './server/saved-routes';

export function googleMapsUrl(savedRoute: SavedRoute) {
  const origin = savedRoute.snapshot.endpoints.from;
  const destination = savedRoute.snapshot.endpoints.to;
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    origin,
    destination
  });

  if (savedRoute.snapshot.handoffStops.length > 0) {
    params.set('waypoints', savedRoute.snapshot.handoffStops.map((stop) => stop.label).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function appleMapsUrl(savedRoute: SavedRoute) {
  const origin = savedRoute.snapshot.endpoints.from;
  const destination = savedRoute.snapshot.endpoints.to;

  return `https://maps.apple.com/?dirflg=d&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`;
}

export function routeGeometryWarning(savedRoute: SavedRoute) {
  const isFastest = savedRoute.snapshot.source === 'ors-fastest';
  const hasHandoffStops = savedRoute.snapshot.handoffStops.length > 0;

  if (hasHandoffStops) {
    return 'This Saved Route uses visible Shaping Stops to encourage external navigation apps to follow the intended Corridor. Google Maps receives those stops as waypoints; Apple Maps web links open endpoints only, so add Shaping Stops manually there. Confirm the full route before driving.';
  }

  return isFastest
    ? 'External navigation apps may still change the planned route because of traffic, closures, or app settings.'
    : 'This Saved Route was chosen for its Corridor, but this handoff does not yet have Shaping Stops. Google or Apple Maps may choose a different path.';
}
