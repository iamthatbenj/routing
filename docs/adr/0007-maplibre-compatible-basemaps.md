# Use MapLibre-compatible basemaps, not vector-only maps

The app will keep MapLibre-compatible rendering for route, Highlight, endpoint, and Shaping Stop overlays, but the basemap itself may be raster or vector depending on which provider/style gives travelers the best contextual detail. This supersedes the vector-only assumption in ADR 0002: provider portability and overlay control remain important, but requiring vector tiles for the basemap may produce a sparser map than travelers need for route comparison.
