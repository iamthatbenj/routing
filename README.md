# Routing

A mobile-first web app for planning Trips and comparing Interesting Routes between Routing Places in the contiguous United States.

## Development

Install dependencies:

```sh
npm install
```

Copy environment defaults and run migrations:

```sh
cp .env.example .env
npm run db:migrate
```

Run the app locally:

```sh
npm run dev
```

Run automated checks:

```sh
npm run check
```

Build for production:

```sh
npm run build
```

## Map configuration

MapLibre maps use named basemap configs so the app can evaluate raster or vector basemaps while preserving route and Highlight overlays.

Local development falls back to `demo-vector`, backed by MapLibre demo tiles. The evaluation switcher also includes `osm-standard-raster`, a raster OpenStreetMap candidate for comparing richer map context.

Select the default basemap with:

```env
PUBLIC_BASEMAP_ID=demo-vector
```

To test a vector style, set:

```env
PUBLIC_MAP_STYLE_URL=https://example.com/style.json
```

To test a raster tile basemap, set:

```env
PUBLIC_BASEMAP_ID=custom-raster
PUBLIC_RASTER_TILE_URL=https://tile-provider.example/{z}/{x}/{y}.png
PUBLIC_RASTER_TILE_ATTRIBUTION=Required provider attribution
```

Do not assume demo tiles are suitable for production traffic; choose a provider and follow its attribution, rate-limit, and terms requirements before deployment.

MapLibre is loaded with a client-only dynamic import when the map scrolls near the viewport. The production build may still report a large MapLibre chunk; that is an accepted TB3 trade-off while the Trip-first UI avoids loading map code until the map is needed.

## Project guidance

Before coding, read:

- `AGENTS.md`
- `llm/README.md`
- `CONTEXT.md`
- relevant ADRs in `docs/adr/`
