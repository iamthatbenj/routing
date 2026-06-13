export type BasemapKind = 'vector' | 'raster';

export type BasemapConfig = {
  id: string;
  name: string;
  kind: BasemapKind;
  attribution: string;
  style: string | Record<string, unknown>;
};

export type BasemapEnvironment = {
  PUBLIC_BASEMAP_ID?: string;
  PUBLIC_MAP_STYLE_URL?: string;
  PUBLIC_RASTER_TILE_URL?: string;
  PUBLIC_RASTER_TILE_ATTRIBUTION?: string;
};

const demoVectorStyleUrl = 'https://demotiles.maplibre.org/style.json';

export function basemapConfigs(env: BasemapEnvironment): BasemapConfig[] {
  const demoVector: BasemapConfig = {
    id: 'demo-vector',
    name: 'MapLibre demo vector',
    kind: 'vector',
    attribution: 'MapLibre demo tiles are for local development only.',
    style: env.PUBLIC_MAP_STYLE_URL || demoVectorStyleUrl
  };

  const osmRaster: BasemapConfig = {
    id: 'osm-standard-raster',
    name: 'OpenStreetMap Standard raster',
    kind: 'raster',
    attribution: '© OpenStreetMap contributors',
    style: rasterStyle({
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors',
      name: 'OpenStreetMap Standard raster'
    })
  };

  const configs = [demoVector, osmRaster];

  if (env.PUBLIC_RASTER_TILE_URL) {
    configs.push({
      id: 'custom-raster',
      name: 'Configured raster basemap',
      kind: 'raster',
      attribution: env.PUBLIC_RASTER_TILE_ATTRIBUTION || 'Raster basemap attribution must be configured before production use.',
      style: rasterStyle({
        tiles: [env.PUBLIC_RASTER_TILE_URL],
        attribution: env.PUBLIC_RASTER_TILE_ATTRIBUTION || 'Raster basemap attribution required',
        name: 'Configured raster basemap'
      })
    });
  }

  return configs;
}

export function resolveBasemap(env: BasemapEnvironment, requestedId = env.PUBLIC_BASEMAP_ID) {
  const configs = basemapConfigs(env);
  return configs.find((config) => config.id === requestedId) ?? configs[0];
}

function rasterStyle({ tiles, attribution, name }: { tiles: string[]; attribution: string; name: string }) {
  return {
    version: 8,
    name,
    sources: {
      raster_basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution
      }
    },
    layers: [
      {
        id: 'raster-basemap',
        type: 'raster',
        source: 'raster_basemap'
      }
    ]
  };
}
