# Tracer Bullet Implementation Plan

Goal: prove the core loop end-to-end with real persistence, real external routing, seeded Denver → Moab Highlights, and simple scoring.

## Slice

A traveler can create an anonymous Trip, add Denver and Moab as Trip Stops, compare Route Options for the Leg, save a preferred route, and open a Leg Handoff stub with external navigation links/context.

## Milestones

### 1. Project foundation

- Create SvelteKit + TypeScript app.
- Add basic styling system for mobile-first responsive layouts.
- Configure Turso client and environment variables.
- Add database migration workflow.

Acceptance:
- App runs locally.
- A health/debug page can read/write a test row in Turso.

### 2. Core Trip persistence

- Tables for Trips, Trip Stops, Legs, Route Searches, Route Options, Saved Routes, and edit/share tokens.
- Create Trip flow with private edit token.
- Add/reorder Trip Stops using Routing Places.
- Derive Legs from adjacent Trip Stops.

Acceptance:
- User can create a Trip, add Denver and Moab, close/reopen via edit link, and see the same Trip.

### 3. Routing Place gazetteer seed

- Seed minimal Routing Places needed for tracer bullet: Denver, Moab, plus route-generation anchors if needed.
- Build city/place autocomplete over local/Turso gazetteer.

Acceptance:
- Trip Stop entry resolves Denver and Moab without external geocoding.

### 4. Seed Highlights and H3 index

- Seed Denver → Moab Highlights/Scenic Segments:
  - Rocky Mountain National Park
  - Colorado National Monument
  - Glenwood Canyon Scenic Segment
  - Dinosaur National Monument
  - Black Canyon of the Gunnison
  - Arches/Canyonlands as Moab destination context
- Store Highlight category, strength, coordinates/geometry, source label, and H3 cells.

Acceptance:
- Backend can fetch seeded Highlights near a route corridor using H3.

### 5. OpenRouteService experiment

- Integrate ORS for driving route geometry, duration, distance, alternatives, and waypoint routes.
- Generate candidates from:
  - fastest route;
  - ORS alternatives if available;
  - routes via top Anchors.
- Store Route Search status and candidate Route Options progressively enough for reloads.

Acceptance:
- Denver → Moab Route Search produces at least fastest + one interesting alternative with geometry/duration/distance.

### 6. Simple scoring and corridor dedupe

- Score Route Options with:
  - weighted nearby Highlights;
  - Directness penalty vs fastest;
  - optional Scenic Segment bonus.
- Exclude endpoint-associated Highlights from comparative score.
- Dedupe near-identical candidates into Corridors.

Acceptance:
- UI shows fastest baseline plus ranked interesting alternative(s), with clear time/distance deltas and explanation bullets.

### 7. Route comparison UI

- Mobile-first Trip page:
  - Trip Stop list;
  - Leg card;
  - route comparison cards;
  - Direct/Balanced/Adventurous selector defaulting to Balanced.
- Desktop enhancement with wider comparison layout.
- Map preview optional/secondary for tracer bullet.

Acceptance:
- User can compare options without needing the map as the primary interface.

### 8. Save preferred route

- Let a Leg keep multiple candidate Saved Routes with one preferred.
- Snapshot selected Route Option as presented.
- Preserve warnings/explanations and source IDs for later refresh.

Acceptance:
- User can mark a preferred route and see it persist on reload.

### 9. Leg Handoff stub

- Generate app context link for the Leg.
- Generate Google/Apple Maps link from endpoints plus selected detour/handoff stops where possible.
- Show warning that external navigation may alter route geometry.
- Include visible/removable Shaping Stops only if implemented; otherwise stub as future affordance.

Acceptance:
- User can open a Leg Handoff page and launch an external nav link for the preferred route.

## Deferred from tracer bullet

- Full Highlight enrichment pipeline from OSM/Wikidata/NPS.
- Real seasonal closure/access data.
- Ferry Segment handling.
- Food Highlights.
- Full MapLibre route map.
- Analytics.
- Account/auth system.
- Production routing-provider commitment ADR.
