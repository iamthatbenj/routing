export type BasemapKind = 'vector' | 'raster';

export type OverlayTheme = {
  casingColor: string;
  fastestColor: string;
  interestingColor: string;
  selectedInterestingColor: string;
  highlightColor: string;
  scenicColor: string;
  contextColor: string;
  endpointColor: string;
  shapingColor: string;
  markerStrokeColor: string;
};

export type BasemapConfig = {
  id: string;
  name: string;
  kind: BasemapKind;
  attribution: string;
  style: string | Record<string, unknown>;
  overlayTheme: OverlayTheme;
};

export type BasemapEnvironment = {
  PUBLIC_BASEMAP_ID?: string;
  PUBLIC_MAP_STYLE_URL?: string;
  PUBLIC_RASTER_TILE_URL?: string;
  PUBLIC_RASTER_TILE_ATTRIBUTION?: string;
};

const demoVectorStyleUrl = 'https://demotiles.maplibre.org/style.json';

const standardOverlayTheme: OverlayTheme = {
  casingColor: '#fffaf1',
  fastestColor: '#3f4a44',
  interestingColor: '#23634b',
  selectedInterestingColor: '#d0631e',
  highlightColor: '#23634b',
  scenicColor: '#2f6fa8',
  contextColor: '#7c6142',
  endpointColor: '#111814',
  shapingColor: '#d0631e',
  markerStrokeColor: '#fffaf1'
};

const detailedRasterOverlayTheme: OverlayTheme = {
  casingColor: '#ffffff',
  fastestColor: '#27322c',
  interestingColor: '#006b50',
  selectedInterestingColor: '#c43f00',
  highlightColor: '#00724e',
  scenicColor: '#005fb8',
  contextColor: '#6a4f2d',
  endpointColor: '#050807',
  shapingColor: '#c43f00',
  markerStrokeColor: '#ffffff'
};

export function basemapConfigs(env: BasemapEnvironment): BasemapConfig[] {
  const demoVector: BasemapConfig = {
    id: 'demo-vector',
    name: 'MapLibre demo vector',
    kind: 'vector',
    attribution: 'MapLibre demo tiles are for local development only.',
    style: env.PUBLIC_MAP_STYLE_URL || demoVectorStyleUrl,
    overlayTheme: standardOverlayTheme
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
    }),
    overlayTheme: detailedRasterOverlayTheme
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
      }),
      overlayTheme: detailedRasterOverlayTheme
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
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
