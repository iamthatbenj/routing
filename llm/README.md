# LLM Project Instructions

This folder consolidates planning and implementation guidance for coding agents. Keep durable domain language in `CONTEXT.md`, durable decisions in `docs/adr/`, and active tracer-bullet planning here.

## Project shape

Routing is a mobile-first web app that helps travelers plan Trips and choose Interesting Routes between Routing Places in the contiguous United States.

The first tracer bullet proves this loop:

Trip → Trip Stops → Leg → Route Search → Route Options → preferred Saved Route → Leg Handoff.

## Required reading before implementation

- `CONTEXT.md` for canonical domain language.
- `docs/adr/` for architectural decisions.
- `llm/tracer-bullets.md` for current tracer-bullet scope and issue links.

## Current architectural commitments

- SvelteKit + TypeScript for the web app.
- Turso as the initial primary database.
- MapLibre-compatible map rendering with provider-swappable raster or vector basemaps.
- App-owned Routing Place gazetteer for Endpoint and Trip Stop search.
- H3 indexes for initial route-to-Highlight spatial matching.
- Anonymous Trip editing through private edit links.
- Vercel-compatible deployment, but avoid Vercel-only assumptions unless deliberately decided later.

## Development expectations

- Build vertical slices that are demoable end-to-end.
- Prefer Trip-first user flows; maps come later in the planning process.
- Use domain terms from `CONTEXT.md`: Trip, Trip Stop, Leg, Route Search, Route Option, Saved Route, Leg Handoff, Highlight, Routing Place, Directness, Corridor.
- Avoid “itinerary” unless deliberately revisiting the glossary.
- Keep external routing provider choices experimental until a provider ADR is created.
- Do not commit secrets, API keys, private edit tokens, or generated local database files.

## Documentation rules

- Keep `CONTEXT.md` glossary-only, with no implementation details.
- Create ADRs sparingly for hard-to-reverse, surprising, trade-off decisions.
- Keep tracer-bullet plans and agent-facing implementation notes in this `llm/` folder.
- Prefer updating existing planning docs over creating new Markdown files.
