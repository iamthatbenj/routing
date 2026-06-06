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
