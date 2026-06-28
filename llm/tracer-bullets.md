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

## TB4 — Leg Handoff and Shaping Stop quality

Goal: make Leg Handoff trustworthy enough that a traveler can open a Saved Route in Google Maps and expect the generated waypoints to preserve the intended Corridor reasonably well.

A traveler who chooses an Interesting Route can understand and use the generated Shaping Stops without being surprised by noisy, misplaced, or ineffective waypoints.

### Scope

- Define what makes a Shaping Stop good enough for navigation handoff.
- Improve Shaping Stop selection/capping for Google Maps waypoint handoff.
- Add lightweight diagnostics to explain generated Shaping Stops.
- Human-in-the-loop Google Maps verification against Denver → Moab Saved Routes.
- Close out the Shaping Stop quality concern captured during TB3.

### Good-enough Shaping Stops criteria

For TB4, Shaping Stops are good enough when they preserve the intended Saved Route Corridor in Google Maps without making handoff noisy or brittle. Prefer stops that are on or very near navigable roads, distributed along meaningful Corridor divergences, not near endpoints, and understandable in manual stop order. Cap Google Maps waypoint handoff at **five Shaping Stops** for now; fewer is better when the Corridor is already preserved. Apple Maps remains endpoints-only and is not a measure of Shaping Stop success.

Failure modes: stops that land on the wrong road or non-road place, stops that cause Google Maps to leave the intended Corridor, too many/noisy stops, stops clustered near endpoints, or stop labels/order that make the handoff hard to understand.

### GitHub issues

1. [TB4.01 Define good-enough Shaping Stops](https://github.com/iamthatbenj/routing/issues/44)
2. [TB4.02 Improve Shaping Stop selection](https://github.com/iamthatbenj/routing/issues/45)
3. [TB4.03 Add Leg Handoff Shaping Stop diagnostics](https://github.com/iamthatbenj/routing/issues/46)
4. [TB4.04 Google Maps handoff verification pass](https://github.com/iamthatbenj/routing/issues/47)
5. [TB4.05 Close out Shaping Stop quality follow-up](https://github.com/iamthatbenj/routing/issues/40)

### Deferred from TB4

- Apple Maps multi-stop handoff unless a reliable web URL approach is found.
- Full navigation provider integration beyond outbound links.
- Manual route editing/dragging.

## TB5 — Route Option explanation and scoring transparency

Goal: make Route Option comparison more trustworthy by explaining why each Interesting Route exists, which Anchors/Highlights shaped it, and how the Interest Score trades off against extra time.

A traveler comparing a Leg can understand the difference between the fastest baseline and Anchor-generated Interesting Routes without needing to infer the product logic from route names alone.

### Scope

- Make Anchor-generated routes explicit in the comparison UI.
- Persist structured Route Option reasons/metadata alongside existing explanation text.
- Improve Interest Score explanation with component-level context.
- Seed one more route corridor or Anchor to avoid overfitting the current comparison.
- Human-in-the-loop review of route cards, map overlays, score explanations, and handoff context.

### GitHub issues

1. [TB5.01 Make Anchor Routes explicit in the UI](https://github.com/iamthatbenj/routing/issues/50)
2. [TB5.02 Persist structured Route Option reasons](https://github.com/iamthatbenj/routing/issues/51)
3. [TB5.03 Improve Interest Score explanation](https://github.com/iamthatbenj/routing/issues/52)
4. [TB5.04 Seed one more route corridor or Anchor](https://github.com/iamthatbenj/routing/issues/53)
5. [TB5.05 Route comparison explanation review](https://github.com/iamthatbenj/routing/issues/54)

### Deferred from TB5

- Full OSM/Wikidata/NPS Highlight ingestion pipeline.
- Manual route dragging/editing.
- Production basemap provider selection.
- Account/auth system.

## TB6 — Saved Route management and Trip workflow polish

Goal: make Saved Routes easier to understand and manage so a traveler can save, prefer, rename, delete, and hand off the route they actually intend to use.

A traveler comparing a Leg can keep multiple Saved Routes, clearly see which one is preferred, update titles for their own planning language, remove routes they no longer want, and open Leg Handoff from the preferred route.

### Scope

- Improve Saved Route cards with source/type, Anchor, score, time/distance, Shaping Stop count, and preferred state.
- Delete Saved Routes with predictable fallback when deleting the preferred route.
- Rename Saved Routes while preserving Route Option snapshot metadata.
- Improve preferred Saved Route selection and Route Option saved/preferred hints.
- Human-in-the-loop review of save/rename/delete/prefer/handoff workflow.

### GitHub issues

1. [TB6.01 Improve Saved Route cards](https://github.com/iamthatbenj/routing/issues/59)
2. [TB6.02 Delete Saved Routes](https://github.com/iamthatbenj/routing/issues/60)
3. [TB6.03 Rename Saved Routes](https://github.com/iamthatbenj/routing/issues/61)
4. [TB6.04 Improve preferred Saved Route selection](https://github.com/iamthatbenj/routing/issues/62)
5. [TB6.05 Saved Route workflow review](https://github.com/iamthatbenj/routing/issues/63)

### Deferred from TB6

- Account/auth system.
- Full read-only sharing workflow.
- Manual route editing/dragging.
- Production basemap provider selection.

## TB7 — Read-only Trip sharing

Goal: let a traveler share a read-only Trip link so another person can understand Trip Stops, Legs, Preferred Saved Routes, maps, and Handoff context without exposing the private edit token.

A shared viewer can open a Trip share link and review the planning context, but cannot edit stops, save/delete/rename routes, or change the Preferred Saved Route.

### Scope

- Surface the existing read-only share link from the private edit page.
- Expand the share page with Trip Stops, Legs, and Preferred Saved Route summaries.
- Add MapShell-backed Preferred Saved Route maps to the share page.
- Add read-only Handoff context without exposing the private edit token.
- Human-in-the-loop review of edit-vs-share privacy and mobile/desktop share UX.

### GitHub issues

1. [TB7.01 Surface read-only share links](https://github.com/iamthatbenj/routing/issues/69)
2. [TB7.02 Expand share page content](https://github.com/iamthatbenj/routing/issues/70)
3. [TB7.03 Add maps to share page](https://github.com/iamthatbenj/routing/issues/71)
4. [TB7.04 Add share-page Handoff context](https://github.com/iamthatbenj/routing/issues/72)
5. [TB7.05 Share workflow review](https://github.com/iamthatbenj/routing/issues/73)

### Deferred from TB7

- Account/auth system.
- Editable collaboration or permission management.
- Public discovery/search of Trips.
- Production basemap provider selection.

## TB8 — Database workflow and Turso readiness

Goal: make it safe and obvious to run Routing against either the default local libSQL database or a Turso/remote libSQL database.

A developer can see which database is active, apply migrations intentionally, and verify Turso connectivity without confusing local, share, or test data.

### Scope

- Document local vs Turso database modes and env vars.
- Add a database status command.
- Make remote migrations require explicit confirmation.
- Verify Turso connection/migration workflow when credentials are available.
- Human-in-the-loop review of the database workflow in one larger PR.

### GitHub issues

1. [TB8.01 Document database modes and env setup](https://github.com/iamthatbenj/routing/issues/78)
2. [TB8.02 Add database status command](https://github.com/iamthatbenj/routing/issues/79)
3. [TB8.03 Make migration runner safer](https://github.com/iamthatbenj/routing/issues/80)
4. [TB8.04 Verify Turso connection and migrations](https://github.com/iamthatbenj/routing/issues/81)
5. [TB8.05 Database workflow review](https://github.com/iamthatbenj/routing/issues/82)

### Deferred from TB8

- Production deployment/secrets management.
- Automated backups or Turso branching workflows.
- Account/auth system.
- Production basemap provider selection.

## TB9 — Vercel deploy readiness

Goal: make Routing ready to deploy and smoke-test on Vercel with Turso, route search, basemaps, app icons, and share links configured.

A project owner can deploy Routing to Vercel, configure the required environment, run migrations intentionally, and verify the core Trip planning/share workflow in a hosted environment.

### Scope

- Add basic app icons and metadata.
- Prepare/document Vercel deployment configuration.
- Add a production environment checklist.
- Smoke-test the deployed app.
- Human-in-the-loop deploy readiness review.

### GitHub issues

1. [TB9.01 Add app icons and metadata](https://github.com/iamthatbenj/routing/issues/84)
2. [TB9.02 Add Vercel deployment configuration](https://github.com/iamthatbenj/routing/issues/85)
3. [TB9.03 Add production environment checklist](https://github.com/iamthatbenj/routing/issues/86)
4. [TB9.04 Smoke-test deployed app](https://github.com/iamthatbenj/routing/issues/87)
5. [TB9.05 Deploy readiness review](https://github.com/iamthatbenj/routing/issues/88)

### Deferred from TB9

- Production basemap provider commitment.
- Account/auth system.
- Automated monitoring/observability.
- Backup/restore workflows.

## TB10 — Free-tier basemap provider evaluation

Goal: find a free-tier-safe production-ish basemap option for the deployed app, or explicitly keep basemaps experimental if the free options are too constrained.

A traveler using the deployed app sees useful route context without the project owner taking on near-term map tile costs or committing to a paid provider.

### Scope

- Shortlist free-tier or zero-cost MapLibre-compatible basemap candidates.
- Add one free-tier candidate configuration for deployed evaluation.
- Compare free basemaps on Denver → Moab route flows.
- Document attribution, rate limits, API key exposure, and free-tier production risks.
- Make a free-tier basemap decision, reusing the earlier provider follow-up issue as the closeout ticket.

### GitHub issues

1. [TB10.01 Shortlist free-tier basemap candidates](https://github.com/iamthatbenj/routing/issues/92)
2. [TB10.02 Add one free-tier basemap candidate config](https://github.com/iamthatbenj/routing/issues/93)
3. [TB10.03 Compare free basemaps on deployed route flows](https://github.com/iamthatbenj/routing/issues/94)
4. [TB10.04 Document free-tier basemap limits and risks](https://github.com/iamthatbenj/routing/issues/95)
5. [TB10.05 Free-tier basemap decision](https://github.com/iamthatbenj/routing/issues/43)

### Deferred from TB10

- Paid basemap provider commitment.
- Self-hosted tile infrastructure.
- Full Protomaps/PMTiles implementation unless selected as a later direction.
- Production monitoring/observability.

## TB11 — Responsive layout polish

Goal: make Routing feel intentionally designed on both mobile and desktop without abandoning the mobile-first workflow.

A user on desktop sees a coherent Trip planning workspace rather than phone-sized panels scattered across a wide page, while a mobile user keeps the current simple vertical flow.

### Scope

- Audit deployed responsive layout across the main pages.
- Establish a reusable responsive page shell or layout pattern.
- Polish the Trip edit page desktop layout.
- Polish share and Handoff page desktop layouts.
- Review the deployed app and decide whether layout is good enough for now.

### GitHub issues

1. [TB11.01 Audit deployed responsive layout](https://github.com/iamthatbenj/routing/issues/98)
2. [TB11.02 Establish responsive desktop page shell](https://github.com/iamthatbenj/routing/issues/99)
3. [TB11.03 Polish Trip edit desktop layout](https://github.com/iamthatbenj/routing/issues/100)
4. [TB11.04 Polish share and handoff desktop layouts](https://github.com/iamthatbenj/routing/issues/101)
5. [TB11.05 Responsive layout review](https://github.com/iamthatbenj/routing/issues/102)

### Deferred from TB11

- Full visual brand redesign.
- Navigation/account system.
- Advanced map-first desktop planner.
- Route provider replacement or ORS review.
- More basemap provider evaluation.

## TB12 — Route Search reliability and provider fallback

Goal: make Route Search more reliable and understandable when provider routing fails, while keeping Anchor-generated Corridors as the primary Interesting Route concept.

A user can understand whether a Route Search succeeded, partially succeeded, or failed — and still see useful route-planning guidance instead of a dead end.

### Scope

- Audit current Route Search failure modes.
- Improve user-facing Route Search error messaging.
- Add fallback Anchor Corridors when ORS/provider routing fails.
- Add lightweight provider diagnostics.
- Review success, failure, fallback, Saved Route, and Handoff behavior.

### GitHub issues

1. [TB12.01 Audit route search failure modes](https://github.com/iamthatbenj/routing/issues/106)
2. [TB12.02 Improve Route Search error messaging](https://github.com/iamthatbenj/routing/issues/107)
3. [TB12.03 Add fallback Anchor Corridors when ORS fails](https://github.com/iamthatbenj/routing/issues/108)
4. [TB12.04 Add route provider diagnostics](https://github.com/iamthatbenj/routing/issues/109)
5. [TB12.05 Route search reliability review](https://github.com/iamthatbenj/routing/issues/110)

### Deferred from TB12

- Full route provider replacement.
- Paid routing provider decision.
- Offline/self-hosted routing.
- Editable Shaping Stops.
- Turn-by-turn navigation.

## TB13 — Multi-leg Trip workflow

Status: Complete as of 2026-06-27. GitHub issues are closed and the work is at a stopping point.

Goal: make Routing support a Trip with multiple Legs as a coherent planning workflow.

A user can add 3+ Trip Stops, compare routes per Leg, select a Preferred Saved Route for each Leg, and understand the overall Trip plan.

### Scope

- Audit current multi-leg behavior with 3+ Trip Stops.
- Add Leg navigation and planning summary on the Trip edit page.
- Clarify per-Leg Saved Route workflow and actions.
- Add a whole-Trip itinerary summary once Legs have Preferred Saved Routes.
- Polish the read-only share page for multi-leg Trips.
- Review single-Leg and multi-Leg workflows after implementation.

### GitHub issues

1. [TB13.01 Audit current multi-leg behavior](https://github.com/iamthatbenj/routing/issues/115)
2. [TB13.02 Add Leg navigation and planning summary](https://github.com/iamthatbenj/routing/issues/116)
3. [TB13.03 Clarify per-Leg Saved Route workflow](https://github.com/iamthatbenj/routing/issues/117)
4. [TB13.04 Add whole-Trip itinerary summary](https://github.com/iamthatbenj/routing/issues/122)
5. [TB13.05 Polish share page for multi-leg Trips](https://github.com/iamthatbenj/routing/issues/118)
6. [TB13.06 Multi-leg workflow review](https://github.com/iamthatbenj/routing/issues/119)

### Deferred from TB13

- Whole-trip optimization.
- Drag-and-drop Trip Stop reordering.
- Day-by-day itinerary planning.
- Lodging/date model.
- Multi-leg map overview across the entire Trip.
- Export whole Trip to navigation.

## TB14 — Trip Stop management and Leg stability

Goal: make multi-leg Trips maintainable after initial creation by letting travelers edit and remove Trip Stops while clearly preserving or invalidating Leg planning context.

A traveler can edit Trip Stop details, delete unwanted Trip Stops, reorder stops, and still understand which current Legs have Route Searches, Saved Routes, Preferred Saved Routes, or need new planning work.

### Scope

- Edit Trip Stop details without changing the Routing Place or order.
- Delete Trip Stops with clear messaging about adjacent Leg impact.
- Prevent stale Saved Routes from appearing as current choices after Trip Stop deletion or reordering.
- Improve current Leg states after Trip Stop changes.
- Review single-Leg and multi-Leg Trip Stop management workflows.

### GitHub issues

1. [TB14.01 Edit Trip Stop details](https://github.com/iamthatbenj/routing/issues/125)
2. [TB14.02 Delete Trip Stops with Leg impact messaging](https://github.com/iamthatbenj/routing/issues/126)
3. [TB14.03 Guard Saved Routes when Trip Stop order changes](https://github.com/iamthatbenj/routing/issues/127)
4. [TB14.04 Improve Trip Stop and Leg changed-state UI](https://github.com/iamthatbenj/routing/issues/128)
5. [TB14.05 Trip Stop management workflow review](https://github.com/iamthatbenj/routing/issues/129)

### Deferred from TB14

- Drag-and-drop Trip Stop reordering.
- Lodging/date model.
- Day-by-day itinerary planning.
- Whole-trip optimization.
- Account/auth system.
