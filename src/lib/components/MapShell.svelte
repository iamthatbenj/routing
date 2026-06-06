<script lang="ts">
  import './MapShell.css';
  import { onDestroy, onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  type MapStatus = 'loading' | 'ready' | 'error';

  let {
    label = 'Route map',
    center = [-107.2, 39.0],
    zoom = 5.2,
    styleUrl = env.PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json'
  }: {
    label?: string;
    center?: [number, number];
    zoom?: number;
    styleUrl?: string;
  } = $props();

  let mapElement: HTMLDivElement;
  let map: import('maplibre-gl').Map | null = null;
  let status: MapStatus = $state('loading');
  let errorMessage = $state('');

  onMount(async () => {
    try {
      const maplibre = await import('maplibre-gl');
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
</script>

<div class="map-shell" aria-label={label}>
  <div class="map-canvas" bind:this={mapElement}></div>
  {#if status !== 'ready'}
    <div class="map-overlay" class:error={status === 'error'}>
      <p class="eyebrow">MapLibre</p>
      {#if status === 'loading'}
        <strong>Loading map</strong>
        <span>Route geometry, Highlights, and Shaping Stops will appear here in TB2.</span>
      {:else}
        <strong>Map unavailable</strong>
        <span>{errorMessage}</span>
      {/if}
    </div>
  {/if}
</div>
