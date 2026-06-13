<script lang="ts">
  import './MapShell.css';
  import { onDestroy, onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { basemapConfigs, resolveBasemap, type BasemapConfig } from '$lib/basemaps';

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

  export type MapStop = {
    id: string;
    label: string;
    kind: 'endpoint' | 'shaping';
    latitude: number;
    longitude: number;
  };

  type LineStringGeometry = {
    type: 'LineString';
    coordinates: [number, number][];
  };

  type PointFeatureCollection = {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: [number, number] };
      properties: Record<string, string | boolean>;
    }>;
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
    basemap = resolveBasemap(env),
    routeOptions = [],
    selectedRouteId = undefined,
    highlights = [],
    stops = [],
    onRouteSelect = undefined
  }: {
    label?: string;
    center?: [number, number];
    zoom?: number;
    basemap?: BasemapConfig;
    routeOptions?: MapRouteOption[];
    selectedRouteId?: string;
    highlights?: MapHighlight[];
    stops?: MapStop[];
    onRouteSelect?: (routeId: string) => void;
  } = $props();

  const availableBasemaps = basemapConfigs(env);
  const basemapStorageKey = 'routing.selectedBasemapId';

  let selectedBasemap = $state<BasemapConfig>(resolveBasemap(env));
  let mapElement: HTMLDivElement;
  let map: import('maplibre-gl').Map | null = null;
  let maplibreModule: typeof import('maplibre-gl') | null = null;
  let status: MapStatus = $state('loading');
  let errorMessage = $state('');
  let renderedRouteCount = $state(0);
  let renderedHighlightCount = $state(0);
  let renderedStopCount = $state(0);
  let renderedSignature = '';
  let renderedHighlightSignature = '';
  let renderedStopSignature = '';
  let routeClickHandlersAttached = false;
  let highlightClickHandlersAttached = false;
  let stopClickHandlersAttached = false;

  $effect(() => {
    if (status === 'ready') {
      try {
        renderRouteOptions();
        renderHighlights();
        renderStops();
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
      selectedBasemap = storedBasemap() ?? basemap;
      map = new maplibre.Map({
        container: mapElement,
        style: selectedBasemap.style as import('maplibre-gl').StyleSpecification | string,
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

  function switchBasemap(basemapId: string) {
    if (!map || basemapId === selectedBasemap.id) return;

    const nextBasemap = availableBasemaps.find((candidate) => candidate.id === basemapId);
    if (!nextBasemap) return;

    selectedBasemap = nextBasemap;
    sessionStorage.setItem(basemapStorageKey, nextBasemap.id);
    status = 'loading';
    resetRenderedMapContent();

    map.setStyle(nextBasemap.style as import('maplibre-gl').StyleSpecification | string);
    map.once('style.load', () => {
      status = 'ready';
      renderRouteOptions();
      renderHighlights();
      renderStops();
    });
  }

  function storedBasemap() {
    const storedId = sessionStorage.getItem(basemapStorageKey);
    return availableBasemaps.find((candidate) => candidate.id === storedId);
  }

  function resetRenderedMapContent() {
    renderedSignature = '';
    renderedHighlightSignature = '';
    renderedStopSignature = '';
    routeClickHandlersAttached = false;
    highlightClickHandlersAttached = false;
    stopClickHandlersAttached = false;
  }

  function renderRouteOptions() {
    if (!map || !maplibreModule) return;

    const parsedRoutes = routeOptions
      .map((option) => ({ option, geometry: parseLineString(option.geometryJson) }))
      .filter((route): route is { option: MapRouteOption; geometry: LineStringGeometry } => Boolean(route.geometry));
    const primaryRouteId = selectedRouteId ?? parsedRoutes.find((route) => route.option.source !== 'ors-fastest')?.option.id ?? parsedRoutes[0]?.option.id;
    const signature = JSON.stringify({ ids: parsedRoutes.map((route) => route.option.id), primaryRouteId });

    renderedRouteCount = parsedRoutes.length;

    if (signature === renderedSignature) return;
    renderedSignature = signature;

    const source = map.getSource('route-options') as import('maplibre-gl').GeoJSONSource | undefined;
    const geojson: RouteFeatureCollection = {
      type: 'FeatureCollection',
      features: parsedRoutes.map(({ option, geometry }) => ({
        type: 'Feature',
        geometry,
        properties: { id: option.id, source: option.source, primary: option.id === primaryRouteId }
      }))
    };

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('route-options', { type: 'geojson', data: geojson });
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
    const geojson: PointFeatureCollection = {
      type: 'FeatureCollection',
      features: validHighlights.map((highlight) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [highlight.longitude, highlight.latitude] },
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
      map.addSource('highlights', { type: 'geojson', data: geojson });
      addHighlightLayers();
      attachHighlightClickHandlers();
    }
  }

  function renderStops() {
    if (!map) return;

    const validStops = stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));
    const signature = JSON.stringify(validStops.map((stop) => `${stop.id}:${stop.kind}`));

    renderedStopCount = validStops.length;

    if (signature === renderedStopSignature) return;
    renderedStopSignature = signature;

    const source = map.getSource('handoff-stops') as import('maplibre-gl').GeoJSONSource | undefined;
    const geojson: PointFeatureCollection = {
      type: 'FeatureCollection',
      features: validStops.map((stop) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [stop.longitude, stop.latitude] },
        properties: { id: stop.id, label: stop.label, kind: stop.kind }
      }))
    };

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('handoff-stops', { type: 'geojson', data: geojson });
      addStopLayers();
      attachStopClickHandlers();
    }
  }

  function addRouteLayers() {
    if (!map) return;

    const theme = selectedBasemap.overlayTheme;

    map.addLayer({
      id: 'route-options-casing',
      type: 'line',
      source: 'route-options',
      paint: {
        'line-color': theme.casingColor,
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 12, 7],
        'line-opacity': 0.96
      }
    });
    map.addLayer({
      id: 'route-options-fastest',
      type: 'line',
      source: 'route-options',
      filter: ['==', ['get', 'source'], 'ors-fastest'],
      paint: {
        'line-color': theme.fastestColor,
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 5.5, 3.5],
        'line-dasharray': [1.5, 1.25],
        'line-opacity': ['case', ['boolean', ['get', 'primary'], false], 0.96, 0.72]
      }
    });
    map.addLayer({
      id: 'route-options-interesting',
      type: 'line',
      source: 'route-options',
      filter: ['!=', ['get', 'source'], 'ors-fastest'],
      paint: {
        'line-color': ['case', ['boolean', ['get', 'primary'], false], theme.selectedInterestingColor, theme.interestingColor],
        'line-width': ['case', ['boolean', ['get', 'primary'], false], 6.5, 4],
        'line-opacity': ['case', ['boolean', ['get', 'primary'], false], 0.98, 0.78]
      }
    });
  }

  function addHighlightLayers() {
    if (!map) return;

    const theme = selectedBasemap.overlayTheme;

    map.addLayer({
      id: 'highlight-marker-halos',
      type: 'circle',
      source: 'highlights',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'category'], 'scenic_segment'], 11, ['boolean', ['get', 'endpointContext'], false], 10, 11],
        'circle-color': 'rgba(0, 0, 0, 0.28)',
        'circle-blur': 0.45
      }
    });
    map.addLayer({
      id: 'highlight-markers',
      type: 'circle',
      source: 'highlights',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'category'], 'scenic_segment'], 7, ['boolean', ['get', 'endpointContext'], false], 6, 7],
        'circle-color': ['case', ['==', ['get', 'category'], 'scenic_segment'], theme.scenicColor, ['boolean', ['get', 'endpointContext'], false], theme.contextColor, theme.highlightColor],
        'circle-stroke-color': theme.markerStrokeColor,
        'circle-stroke-width': ['case', ['boolean', ['get', 'endpointContext'], false], 2, 3],
        'circle-opacity': ['case', ['boolean', ['get', 'endpointContext'], false], 0.78, 0.94]
      }
    });
  }

  function addStopLayers() {
    if (!map) return;

    const theme = selectedBasemap.overlayTheme;

    map.addLayer({
      id: 'handoff-stop-halos',
      type: 'circle',
      source: 'handoff-stops',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'kind'], 'endpoint'], 13, 12],
        'circle-color': 'rgba(0, 0, 0, 0.3)',
        'circle-blur': 0.45
      }
    });
    map.addLayer({
      id: 'handoff-stop-markers',
      type: 'circle',
      source: 'handoff-stops',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'kind'], 'endpoint'], 8, 7],
        'circle-color': ['case', ['==', ['get', 'kind'], 'endpoint'], theme.endpointColor, theme.shapingColor],
        'circle-stroke-color': theme.markerStrokeColor,
        'circle-stroke-width': 3
      }
    });
    map.addLayer({
      id: 'handoff-stop-labels',
      type: 'symbol',
      source: 'handoff-stops',
      layout: {
        'text-field': ['case', ['==', ['get', 'kind'], 'endpoint'], 'E', 'S'],
        'text-size': 10,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true
      },
      paint: {
        'text-color': theme.markerStrokeColor,
        'text-halo-color': 'rgba(0, 0, 0, 0.55)',
        'text-halo-width': 1
      }
    });
  }

  function attachRouteClickHandlers() {
    if (!map || routeClickHandlersAttached) return;

    for (const layerId of ['route-options-fastest', 'route-options-interesting']) {
      map.on('click', layerId, (event) => {
        const routeId = event.features?.[0]?.properties?.id;
        if (typeof routeId === 'string') onRouteSelect?.(routeId);
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
    setPointerCursor('highlight-markers');
    highlightClickHandlersAttached = true;
  }

  function attachStopClickHandlers() {
    if (!map || !maplibreModule || stopClickHandlersAttached) return;

    map.on('click', 'handoff-stop-markers', (event) => {
      if (!map || !maplibreModule) return;
      const activeMap = map;
      const activeMaplibre = maplibreModule;
      const feature = event.features?.[0];
      const coordinates = (feature?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
      if (!feature?.properties || !coordinates) return;

      const kind = String(feature.properties.kind) === 'endpoint' ? 'Endpoint' : 'Shaping Stop';
      new activeMaplibre.Popup()
        .setLngLat(coordinates)
        .setHTML(`<strong>${escapeHtml(String(feature.properties.label))}</strong><br>${kind}`)
        .addTo(activeMap);
    });
    setPointerCursor('handoff-stop-markers');
    stopClickHandlersAttached = true;
  }

  function setPointerCursor(layerId: string) {
    if (!map) return;
    map.on('mouseenter', layerId, () => {
      if (map) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      if (map) map.getCanvas().style.cursor = '';
    });
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

  function themeStyle() {
    const theme = selectedBasemap.overlayTheme;
    return [
      `--map-fastest: ${theme.fastestColor}`,
      `--map-interesting: ${theme.selectedInterestingColor}`,
      `--map-highlight: ${theme.highlightColor}`,
      `--map-scenic: ${theme.scenicColor}`,
      `--map-context: ${theme.contextColor}`,
      `--map-endpoint: ${theme.endpointColor}`,
      `--map-shaping: ${theme.shapingColor}`,
      `--map-marker-stroke: ${theme.markerStrokeColor}`
    ].join('; ');
  }

  function escapeHtml(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
</script>

<div class="map-shell" aria-label={label} style={themeStyle()}>
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
  {#if status === 'ready' && availableBasemaps.length > 1}
    <label class="basemap-switcher">
      <span>Basemap</span>
      <select value={selectedBasemap.id} onchange={(event) => switchBasemap(event.currentTarget.value)}>
        {#each availableBasemaps as candidate}
          <option value={candidate.id}>{candidate.name}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if status === 'ready' && (renderedRouteCount > 0 || selectedBasemap)}
    <div class="map-legend" aria-live="polite">
      <strong>{renderedRouteCount > 0 ? `${renderedRouteCount} Corridors` : selectedBasemap.name}</strong>
      {#if renderedRouteCount > 0}
        <span><i class="legend-fastest"></i> Fastest baseline</span>
        <span><i class="legend-interesting"></i> Interesting Route</span>
      {/if}
      {#if renderedStopCount > 0}
        <span><i class="legend-endpoint"></i> Endpoint</span>
        <span><i class="legend-shaping"></i> Shaping Stop</span>
      {/if}
      {#if renderedHighlightCount > 0}
        <span><i class="legend-highlight"></i> Highlight</span>
        <span><i class="legend-scenic"></i> Scenic Segment</span>
        <span><i class="legend-context"></i> Destination context</span>
      {/if}
    </div>
  {/if}
</div>
