import { describe, expect, it } from 'vitest';
import { basemapConfigs, resolveBasemap } from './basemaps';

describe('basemap configuration', () => {
  it('keeps the demo vector basemap available for development', () => {
    const basemap = resolveBasemap({});

    expect(basemap.id).toBe('demo-vector');
    expect(basemap.kind).toBe('vector');
    expect(basemap.style).toBe('https://demotiles.maplibre.org/style.json');
  });

  it('includes a richer raster candidate for evaluation', () => {
    const raster = basemapConfigs({}).find((config) => config.id === 'osm-standard-raster');

    expect(raster?.kind).toBe('raster');
    expect(raster?.attribution).toBe('© OpenStreetMap contributors');
    expect(raster?.style).toMatchObject({
      version: 8,
      sources: {
        raster_basemap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']
        }
      }
    });
  });

  it('can represent the MapTiler Outdoor free-tier candidate when configured', () => {
    const configs = basemapConfigs({
      PUBLIC_MAPTILER_KEY: 'test key'
    });

    const mapTiler = configs.find((config) => config.id === 'maptiler-outdoor');

    expect(mapTiler?.kind).toBe('vector');
    expect(mapTiler?.attribution).toBe('© MapTiler © OpenStreetMap contributors');
    expect(mapTiler?.style).toBe('https://api.maptiler.com/maps/outdoor-v2/style.json?key=test%20key');
  });

  it('can represent a configured raster basemap', () => {
    const configs = basemapConfigs({
      PUBLIC_RASTER_TILE_URL: 'https://example.test/{z}/{x}/{y}.png',
      PUBLIC_RASTER_TILE_ATTRIBUTION: 'Example attribution'
    });

    const raster = configs.find((config) => config.id === 'custom-raster');

    expect(raster?.kind).toBe('raster');
    expect(raster?.attribution).toBe('Example attribution');
    expect(raster?.style).toMatchObject({
      version: 8,
      sources: {
        raster_basemap: {
          type: 'raster',
          tiles: ['https://example.test/{z}/{x}/{y}.png']
        }
      }
    });
  });

  it('does not include the MapTiler candidate without a public key', () => {
    const mapTiler = basemapConfigs({}).find((config) => config.id === 'maptiler-outdoor');

    expect(mapTiler).toBeUndefined();
  });

  it('selects a named basemap when configured', () => {
    const basemap = resolveBasemap({
      PUBLIC_BASEMAP_ID: 'custom-raster',
      PUBLIC_RASTER_TILE_URL: 'https://example.test/{z}/{x}/{y}.png'
    });

    expect(basemap.id).toBe('custom-raster');
  });
});
