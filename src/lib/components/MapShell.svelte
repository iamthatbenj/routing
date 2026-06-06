<script lang="ts">
  import './MapShell.css';
  import { onDestroy, onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  type MapStatus = 'loading' | 'ready' | 'error';

  export type MapRouteOption = {
    id: string;
    name: string;
    source: string;
    geometryJson: string;
  };

  type LineStringGeometry = {
    type: 'LineString';
    coordinates: [number, number][];
  };

  type RouteFeatureCollection = {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: LineStringGeometry;
      properties: { id: string; source: string; primary: boolean };
    }>;
  };

  let {
    label = 'Route map',
    center = [-107.2, 39.0],
    zoom = 5.2,
    styleUrl = env.PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json',
    routeOptions = [],
    selectedRouteId = undefined
  }: {
    label?: string;
    center?: [number, number];
    zoom?: number;
    styleUrl?: string;
    routeOptions?: MapRouteOption[];
    selectedRouteId?: string;
  } = $props();

  let mapElement: HTMLDivElement;
  let map: import('maplibre-gl').Map | null = null;
  let maplibreModule: typeof import('maplibre-gl') | null = null;
  let status: MapStatus = $state('loading');
  let errorMessage = $state('');
  let renderedSignature = '';

  $effect(() => {
    if (status === 'ready') {
      renderRouteOptions();
    }
  });

  onMount(async () => {
    try {
      const maplibre = await import('maplibre-gl');
      maplibreModule = maplibre;
      map = new maplibre.Map({
        container: mapElement,
        style: styleUrl,
        center,
        zoom,
        attributionControl: false
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');
      map.once('load', () => {
        status = 'ready';
      });
      map.once('error', (event) => {
        status = 'error';
        errorMessage = event.error?.message ?? 'The map style could not be loaded.';
      });
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : 'The map could not be initialized.';
    }
  });

  onDestroy(() => {
    map?.remove();
  });

  function renderRouteOptions() {
    if (!map || !maplibreModule) return;

    const parsedRoutes = routeOptions
      .map((option) => ({ option, geometry: parseLineString(option.geometryJson) }))
      .filter((route): route is { option: MapRouteOption; geometry: LineStringGeometry } => Boolean(route.geometry));
    const primaryRouteId = selectedRouteId ?? parsedRoutes.find((route) => route.option.source !== 'ors-fastest')?.option.id ?? parsedRoutes[0]?.option.id;
    const signature = JSON.stringify({
      ids: parsedRoutes.map((route) => route.option.id),
      primaryRouteId
    });

    if (signature === renderedSignature) return;
    renderedSignature = signature;

    const source = map.getSource('route-options') as import('maplibre-gl').GeoJSONSource | undefined;
    const geojson: RouteFeatureCollection = {
      type: 'FeatureCollection',
      features: parsedRoutes.map(({ option, geometry }) => ({
        type: 'Feature',
        geometry,
        properties: {
          id: option.id,
          source: option.source,
          primary: option.id === primaryRouteId
        }
      }))
    };

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('route-options', {
        type: 'geojson',
        data: geojson
      });
      map.addLayer({
        id: 'route-options-casing',
        type: 'line',
        source: 'route-options',
        paint: {
          'line-color': '#fffaf1',
          'line-width': ['case', ['boolean', ['get', 'primary'], false], 8, 5],
          'line-opacity': 0.92
        }
      });
      map.addLayer({
        id: 'route-options-line',
        type: 'line',
        source: 'route-options',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'primary'], false],
            '#d98b2b',
            ['==', ['get', 'source'], 'ors-fastest'],
            '#5f6b61',
            '#23634b'
          ],
          'line-width': ['case', ['boolean', ['get', 'primary'], false], 5, 3],
          'line-dasharray': ['case', ['==', ['get', 'source'], 'ors-fastest'], ['literal', [1.5, 1.25]], ['literal', [1, 0]]],
          'line-opacity': ['case', ['boolean', ['get', 'primary'], false], 0.95, 0.72]
        }
      });
    }

    fitRouteBounds(parsedRoutes.flatMap((route) => route.geometry.coordinates));
  }

  function parseLineString(value: string): LineStringGeometry | null {
    try {
      const geometry = JSON.parse(value) as LineStringGeometry;
      if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
      return geometry;
    } catch {
      return null;
    }
  }

  function fitRouteBounds(coordinates: [number, number][]) {
    if (!map || !maplibreModule || coordinates.length === 0) return;

    const bounds = coordinates.reduce(
      (nextBounds, coordinate) => nextBounds.extend(coordinate),
      new maplibreModule.LngLatBounds(coordinates[0], coordinates[0])
    );
    map.fitBounds(bounds, { padding: 42, duration: 0, maxZoom: 9 });
  }
</script>

<div class="map-shell" aria-label={label}>
  <div class="map-canvas" bind:this={mapElement}></div>
  {#if status !== 'ready' || routeOptions.length === 0}
    <div class="map-overlay" class:error={status === 'error'}>
      <p class="eyebrow">MapLibre</p>
      {#if status === 'loading'}
        <strong>Loading map</strong>
        <span>Route geometry, Highlights, and Shaping Stops will appear here in TB2.</span>
      {:else if status === 'error'}
        <strong>Map unavailable</strong>
        <span>{errorMessage}</span>
      {:else}
        <strong>Route map ready</strong>
        <span>Run a Route Search to draw fastest and interesting Corridors here.</span>
      {/if}
    </div>
  {/if}
</div>
