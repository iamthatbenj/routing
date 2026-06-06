# Routing

Routing helps travelers choose worthwhile driving paths between places in the United States.

## Language

**Interesting Route**:
A driving route between city-level endpoints that is worth choosing because the path connects places travelers may want to see, even when it is not the fastest or shortest option.
_Avoid_: Road trip itinerary, trip plan

**Route Search**:
A persisted comparison between two Endpoints for a selected Directness and interest preferences, containing generated Route Options and their search status.
_Avoid_: Query, job, result set

**Route Option**:
One candidate Interesting Route shown to a traveler for comparison against other candidates between the same endpoints. Primary Route Options should represent different Corridors rather than minor variations of the same path.
_Avoid_: Itinerary, plan, result

**Constrained Route Option**:
A Route Option shown with clear caution because it conflicts with dates, access, Directness, or other planning constraints, while still being useful for comparison or inspiration.
_Avoid_: Risky route, unavailable route, bad route

**Saved Route**:
A Route Option preserved so a traveler can return to it across planning sessions.
_Avoid_: Account route, itinerary

**Trip**:
An ordered collection of Saved Routes and traveler-entered stop details used to plan movement across multiple route searches.
_Avoid_: Folder, itinerary, vacation plan

**Trip Stop**:
A traveler-entered planned place within a Trip, usually represented by a Routing Place plus optional traveler details.
_Avoid_: Highlight, waypoint, destination, reservation

**Leg**:
The planned movement between two adjacent Trip Stops. A Leg may have multiple candidate Saved Routes, with one marked as preferred.
_Avoid_: Segment, drive, route leg

**Leg Handoff**:
A shareable or exportable package for a Leg that helps travelers use the preferred Saved Route in an external navigation app while preserving route context from this app.
_Avoid_: Itinerary, navigation, directions

**Shaping Stop**:
A stop included in a Leg Handoff to encourage an external navigation app to follow the intended Corridor, even when it is not itself a Highlight or Trip Stop.
_Avoid_: Waypoint, via point, hidden stop

**Corridor**:
A meaningfully distinct path between the same endpoints, usually defined by the major regions, roads, or Highlights it passes through.
_Avoid_: Route family, variant, alternative

**Anchor**:
A Highlight, Scenic Segment, or important Routing Place used to generate a candidate Route Option.
_Avoid_: Waypoint, via point, routing seed

**Routing Place**:
A city-level or travel-relevant named place that can serve as the routing anchor for an Endpoint or Trip Stop, including unofficial but widely recognized locales.
_Avoid_: Geocode result, address, arbitrary place

**Endpoint**:
A Routing Place where an Interesting Route starts or ends.
_Avoid_: Stop, waypoint, lodging, address

**Candidate Highlight**:
A possible Highlight that has been identified from source records but has not necessarily passed the evidence and quality threshold to influence route choice.
_Avoid_: Raw POI, attraction candidate

**Highlight**:
A place or road segment that gives a traveler a reason to prefer one Interesting Route over another. A Highlight has its own identity even when it is supported by multiple source records and has passed an evidence and quality threshold.
_Avoid_: POI, attraction, sight, stop

**On-route Highlight**:
A Highlight that lies directly along an Interesting Route without requiring a meaningful departure from the route.
_Avoid_: Included POI

**Detour Highlight**:
A Highlight near an Interesting Route that requires a meaningful departure from the route to visit.
_Avoid_: Nearby POI, off-route stop

**Directness**:
A traveler preference for how much extra time or distance is acceptable in exchange for a more interesting route. Directness is expressed as Direct, Balanced, or Adventurous; a traveler may have a default preference and may choose a different Directness for a specific route search.
_Avoid_: Efficiency, speed, max detour

**Interest Score**:
A route-level estimate of how strongly an Interesting Route is supported by its Highlights.
_Avoid_: POI score, attractiveness score

**Nature Highlight**:
A Highlight whose appeal comes primarily from natural features, public lands, or outdoor scenery.
_Avoid_: Park POI, outdoor attraction

**Landmark Highlight**:
A Highlight whose appeal comes primarily from cultural, historical, scenic, or unusual traveler interest.
_Avoid_: Attraction, roadside site

**Food Highlight**:
An exceptional independent or local food place that can give a traveler a reason to prefer one Interesting Route over another. A food place needs positive evidence of distinctiveness to be a Food Highlight; ordinary restaurant data is not enough.
_Avoid_: Restaurant POI, chain restaurant, dining option

**Scenic Segment**:
A stretch of road whose appeal comes from the experience of driving it, not from a single place along it.
_Avoid_: Scenic road, route highlight, road POI

**Ferry Segment**:
A segment of a Route Option that uses a ferry crossing and carries schedule uncertainty beyond ordinary driving time.
_Avoid_: Ferry route, boat detour

**Visit Effort**:
A coarse estimate of how much time a traveler should expect a Highlight to require, expressed as Quick Stop, Short Visit, Half Day, or Full Day+.
_Avoid_: Duration, dwell time, itinerary time
