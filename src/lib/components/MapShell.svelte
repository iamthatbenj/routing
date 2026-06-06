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

  export type MapHighlight = {
    id: string;
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    visitEffort: string;
    endpointContextPlaceId: string | null;
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

  type HighlightFeatureCollection = {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: [number, number] };
      properties: {
        id: string;
        name: string;
        category: string;
        visitEffort: string;
        endpointContext: boolean;
      };
    }>;
  };

  let {
    label = 'Route map',
    center = [-107.2, 39.0],
    zoom = 5.2,
    styleUrl = env.PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json',
    routeOptions = [],
    selectedRouteId = undefined,
    highlights = [],
    onRouteSelect = undefined
  }: {
    label?: string;
    center?: [number, number];
    zoom?: number;
    styleUrl?: string;
    routeOptions?: MapRouteOption[];
    selectedRouteId?: string;
    highlights?: MapHighlight[];
    onRouteSelect?: (routeId: string) => void;
  } = $props();

  let mapElement: HTMLDivElement;
  let map: import('maplibre-gl').Map | null = null;
  let maplibreModule: typeof import('maplibre-gl') | null = null;
  let status: MapStatus = $state('loading');
  let errorMessage = $state('');
  let renderedRouteCount = $state(0);
  let renderedHighlightCount = $state(0);
  let renderedSignature = '';
  let renderedHighlightSignature = '';
  let routeClickHandlersAttached = false;
  let highlightClickHandlersAttached = false;

  $effect(() => {
    if (status === 'ready') {
      try {
        renderRouteOptions();
        renderHighlights();
      } catch (error) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : 'Map content could not be rendered.';
      }
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

    renderedRouteCount = parsedRoutes.length;

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
      addRouteLayers();
      attachRouteClickHandlers();
    }

    const selectedRoute = parsedRoutes.find((route) => route.option.id === primaryRouteId);
    fitRouteBounds((selectedRoute ? [selectedRoute] : parsedRoutes).flatMap((route) => route.geometry.coordinates));
  }

  function renderHighlights() {
    if (!map) return;

    const validHighlights = highlights.filter((highlight) => Number.isFinite(highlight.latitude) && Number.isFinite(highlight.longitude));
    const signature = JSON.stringify(validHighlights.map((highlight) => highlight.id));

    renderedHighlightCount = validHighlights.length;

    if (signature === renderedHighlightSignature) return;
    renderedHighlightSignature = signature;

    const source = map.getSource('highlights') as import('maplibre-gl').GeoJSONSource | undefined;
    const geojson: HighlightFeatureCollection = {
      type: 'FeatureCollection',
      features: validHighlights.map((highlight) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [highlight.longitude, highlight.latitude]
        },
        properties: {
          id: highlight.id,
          name: highlight.name,
          category: highlight.category,
          visitEffort: highlight.visitEffort,
          endpointContext: Boolean(highlight.endpointContextPlaceId)
        }
      }))
    };

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('highlights', {
        type: 'geojson',
        data: geojson
      });
      addHighlightLayers();
      attachHighlightClickHandlers();
    }
  }

  function addRouteLayers() {
    if (!map) return;

    map.addLayer({
      id: 'route-options-casing',
      type: 'line',
      source: 'route-options',
      paint: {
        'line-color': '#fffaf1',
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 10, 6],
        'line-opacity': 0.95
      }
    });
    map.addLayer({
      id: 'route-options-fastest',
      type: 'line',
      source: 'route-options',
      filter: ['==', ['get', 'source'], 'ors-fastest'],
      paint: {
        'line-color': '#5f6b61',
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 5, 3],
        'line-dasharray': [1.5, 1.25],
        'line-opacity': ['case', ['boolean', ['get', 'primary'], false], 0.95, 0.68]
      }
    });
    map.addLayer({
      id: 'route-options-interesting',
      type: 'line',
      source: 'route-options',
      filter: ['!=', ['get', 'source'], 'ors-fastest'],
      paint: {
        'line-color': ['case', ['boolean', ['get', 'primary'], false], '#d98b2b', '#23634b'],
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 6, 3.5],
        'line-opacity': ['case', ['boolean', ['get', 'primary'], false], 0.98, 0.74]
      }
    });
  }

  function addHighlightLayers() {
    if (!map) return;

    map.addLayer({
      id: 'highlight-markers',
      type: 'circle',
      source: 'highlights',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'category'], 'scenic_segment'], 7, ['boolean', ['get', 'endpointContext'], false], 6, 7],
        'circle-color': [
          'case',
          ['==', ['get', 'category'], 'scenic_segment'],
          '#5d80a6',
          ['boolean', ['get', 'endpointContext'], false],
          '#8f7b58',
          '#23634b'
        ],
        'circle-stroke-color': '#fffaf1',
        'circle-stroke-width': ['case', ['boolean', ['get', 'endpointContext'], false], 2, 3],
        'circle-opacity': ['case', ['boolean', ['get', 'endpointContext'], false], 0.72, 0.92]
      }
    });
  }

  function attachRouteClickHandlers() {
    if (!map || routeClickHandlersAttached) return;

    for (const layerId of ['route-options-fastest', 'route-options-interesting']) {
      map.on('click', layerId, (event) => {
        const routeId = event.features?.[0]?.properties?.id;
        if (typeof routeId === 'string') {
          onRouteSelect?.(routeId);
        }
      });
      map.on('mouseenter', layerId, () => {
        if (map) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        if (map) map.getCanvas().style.cursor = '';
      });
    }

    routeClickHandlersAttached = true;
  }

  function attachHighlightClickHandlers() {
    if (!map || !maplibreModule || highlightClickHandlersAttached) return;

    map.on('click', 'highlight-markers', (event) => {
      if (!map || !maplibreModule) return;
      const activeMap = map;
      const activeMaplibre = maplibreModule;
      const feature = event.features?.[0];
      const coordinates = (feature?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
      if (!feature?.properties || !coordinates) return;

      const category = String(feature.properties.category).replaceAll('_', ' ');
      const endpointContext = feature.properties.endpointContext === true || feature.properties.endpointContext === 'true';
      new activeMaplibre.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `<strong>${escapeHtml(String(feature.properties.name))}</strong><br>` +
            `${escapeHtml(category)} · ${escapeHtml(String(feature.properties.visitEffort))}` +
            (endpointContext ? '<br><em>Destination context, not scored</em>' : '')
        )
        .addTo(activeMap);
    });
    map.on('mouseenter', 'highlight-markers', () => {
      if (map) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'highlight-markers', () => {
      if (map) map.getCanvas().style.cursor = '';
    });

    highlightClickHandlersAttached = true;
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

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
  {#if status === 'ready' && renderedRouteCount > 0}
    <div class="map-legend" aria-live="polite">
      <strong>{renderedRouteCount} Corridors</strong>
      <span><i class="legend-fastest"></i> Fastest baseline</span>
      <span><i class="legend-interesting"></i> Interesting Route</span>
      {#if renderedHighlightCount > 0}
        <span><i class="legend-highlight"></i> Highlight</span>
        <span><i class="legend-scenic"></i> Scenic Segment</span>
        <span><i class="legend-context"></i> Destination context</span>
      {/if}
    </div>
  {/if}
</div>
