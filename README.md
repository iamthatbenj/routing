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

## Database configuration

Routing uses libSQL. Local development defaults to a file-backed database at `file:local.db`.

Check the active database before running migrations:

```sh
npm run db:status
```

The status command prints the database mode, redacted URL, auth-token presence, applied migration count, pending migrations, and latest applied migration. It never prints auth-token values.

### Local database

Use the default local DB in `.env`:

```env
DATABASE_URL=file:local.db
```

Apply local migrations:

```sh
npm run db:migrate
```

### Turso / remote libSQL database

Set Turso env vars instead of `DATABASE_URL`:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
```

Then verify the target:

```sh
npm run db:status
```

Remote migrations require explicit confirmation so a developer does not accidentally migrate the wrong database:

```sh
npm run db:migrate -- --yes
```

or:

```sh
DATABASE_MIGRATE_CONFIRM=1 npm run db:migrate
```

The app, `db:status`, and `db:migrate` all read the same database env vars. They also load `.env` for local commands; shell-provided environment variables take precedence.

### Turso verification checklist

When connecting a new Turso database:

1. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `.env` or your shell.
2. Run `npm run db:status` and confirm the URL/mode point at the intended remote database.
3. Run `npm run db:migrate -- --yes` to apply migrations intentionally.
4. Run `npm run dev`, create a Trip, reload it, and verify `npm run db:status` shows all migrations applied.

## Vercel deployment

Routing uses SvelteKit `adapter-auto`, which detects Vercel during deployment. No committed Vercel secrets or project-specific deployment tokens are required.

Recommended Vercel settings:

- Framework preset: **SvelteKit**
- Build command: `npm run build`
- Install command: `npm install`
- Output directory: managed by SvelteKit / Vercel

Required Vercel environment variables:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
ORS_API_KEY=your-openrouteservice-key
```

Recommended/optional map environment variables:

```env
PUBLIC_BASEMAP_ID=demo-vector
PUBLIC_MAP_STYLE_URL=https://example.com/style.json
PUBLIC_RASTER_TILE_URL=https://tile-provider.example/{z}/{x}/{y}.png
PUBLIC_RASTER_TILE_ATTRIBUTION=Required provider attribution
```

Before deploying, apply migrations to the intended Turso database from a trusted local environment or CI job:

```sh
npm run db:status
npm run db:migrate -- --yes
```

The server-side app uses `@libsql/client` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which is compatible with Vercel's SvelteKit server runtime. Do not use `file:local.db` for Vercel deployments; Vercel serverless filesystems are not a durable application database.

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
