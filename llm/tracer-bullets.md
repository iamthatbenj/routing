# Tracer Bullets

This file tracks active and completed tracer bullets without duplicating full GitHub issue bodies.

## TB1 — Denver → Moab planning loop

Goal: prove the core loop end-to-end with real persistence, real external routing, seeded Denver → Moab Highlights, and simple scoring.

A traveler can create an anonymous Trip, add Denver and Moab as Trip Stops, compare Route Options for the Leg, save a preferred route, and open a Leg Handoff stub with external navigation links/context.

### Scope

- Real SvelteKit app shell.
- Real Turso persistence.
- Private edit links for anonymous Trips.
- Minimal Routing Place gazetteer for Denver → Moab.
- OpenRouteService experiment for route geometry, duration, distance, alternatives, and waypoint/Anchor routes.
- Seeded Highlights and Scenic Segments for Denver → Moab.
- H3-based route-corridor matching.
- Simple Interest Score and Directness penalty.
- Corridor dedupe.
- Preferred Saved Route snapshot.
- Leg Handoff stub with external navigation links and context.

### GitHub issues

1. [TB1.01 Bootstrap the SvelteKit Trip shell](https://github.com/iamthatbenj/routing/issues/1)
2. [TB1.02 Create anonymous Trips with private edit links](https://github.com/iamthatbenj/routing/issues/2)
3. [TB1.03 Add Routing Places and Trip Stops for Denver to Moab](https://github.com/iamthatbenj/routing/issues/3)
4. [TB1.04 Compare a Denver to Moab Leg with real routing](https://github.com/iamthatbenj/routing/issues/4)
5. [TB1.05 Seed Highlights and score Route Options](https://github.com/iamthatbenj/routing/issues/5)
6. [TB1.06 Dedupe Route Options into Corridors](https://github.com/iamthatbenj/routing/issues/6)
7. [TB1.07 Save a preferred Route Option for a Leg](https://github.com/iamthatbenj/routing/issues/7)
8. [TB1.08 Create a Leg Handoff stub](https://github.com/iamthatbenj/routing/issues/8)
9. [TB1.09 Review route-provider fit after ORS experiment](https://github.com/iamthatbenj/routing/issues/9)

### Deferred from TB1

- Full Highlight enrichment pipeline from OSM/Wikidata/NPS.
- Real seasonal closure/access data.
- Ferry Segment handling.
- Food Highlights.
- Full MapLibre route map.
- Analytics.
- Account/auth system.
- Production routing-provider commitment ADR.

## TB2 — Map-backed Leg comparison

Goal: make Route Options visually understandable by showing Corridors, Highlights, and Shaping Stops on MapLibre maps, starting on Leg comparison and reusing the same map foundation on Leg Handoff.

A traveler comparing Route Options for a Leg can see the fastest baseline, Interesting Route Options, seeded Highlights, and handoff Shaping Stops on a map before saving or opening the Leg Handoff.

### Scope

- MapLibre-compatible map foundation.
- Environment-based MapLibre-compatible basemap configuration.
- Route Option geometry rendering from stored ORS LineStrings.
- Card-to-map Route Option selection.
- Seeded Highlight and Scenic Segment markers.
- Leg Handoff map showing preferred Saved Route, endpoints, and Shaping Stops.
- Mobile and desktop layout review for map-backed planning.
- Basemap provider review.

### GitHub issues

1. [TB2.01 Add MapLibre map foundation](https://github.com/iamthatbenj/routing/issues/19)
2. [TB2.02 Render Route Option Corridors on the Leg map](https://github.com/iamthatbenj/routing/issues/20)
3. [TB2.03 Select Route Options from cards and map](https://github.com/iamthatbenj/routing/issues/21)
4. [TB2.04 Show seeded Highlights on the Leg map](https://github.com/iamthatbenj/routing/issues/22)
5. [TB2.05 Show Shaping Stops and endpoints on Leg Handoff maps](https://github.com/iamthatbenj/routing/issues/23)
6. [TB2.06 Mobile map layout pass](https://github.com/iamthatbenj/routing/issues/24)
7. [TB2.07 Map provider review](https://github.com/iamthatbenj/routing/issues/25)

### Deferred from TB2

- Manual route dragging/editing.
- Full Highlight enrichment pipeline.
- Map-based Trip Stop picking.
- Production map provider commitment ADR unless the review produces a concrete decision.

## TB3 — Basemap quality and provider-swappable maps

Goal: evaluate and integrate richer basemaps while preserving MapLibre route, Highlight, endpoint, and Shaping Stop overlays.

A traveler comparing routes can use a basemap with enough geographic and roadside context to understand the route without relying only on app-specific Highlights.

### Scope

- Named basemap provider/style configuration.
- Support for raster or vector MapLibre-compatible basemaps.
- Evaluation basemap switcher.
- Richer raster basemap candidate.
- Overlay legibility across sparse/demo and detailed basemaps.
- Map performance hygiene for the Trip-first mobile flow.
- Human-in-the-loop provider review.

### GitHub issues

1. [TB3.01 Add basemap provider abstraction](https://github.com/iamthatbenj/routing/issues/33)
2. [TB3.02 Add basemap switcher with demo and raster candidate](https://github.com/iamthatbenj/routing/issues/34)
3. [TB3.03 Overlay legibility across basemaps](https://github.com/iamthatbenj/routing/issues/35)
4. [TB3.04 Map performance hygiene](https://github.com/iamthatbenj/routing/issues/36)
5. [TB3.05 Basemap provider review](https://github.com/iamthatbenj/routing/issues/37)

### Deferred from TB3

- Production basemap provider commitment ADR unless the review produces a concrete decision.
- Self-hosted tile infrastructure.
- Manual route editing or map-based Trip Stop picking.
