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

MapLibre maps read a MapLibre-compatible style URL from `PUBLIC_MAP_STYLE_URL`.
If it is not set, local development falls back to MapLibre demo tiles. Do not assume the demo tile service is suitable for production traffic; choose a provider and follow its attribution, rate-limit, and terms requirements before deployment.

## Project guidance

Before coding, read:

- `AGENTS.md`
- `llm/README.md`
- `CONTEXT.md`
- relevant ADRs in `docs/adr/`
