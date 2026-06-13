# Use MapLibre-compatible vector maps

Superseded by [ADR 0007: Use MapLibre-compatible basemaps, not vector-only maps](./0007-maplibre-compatible-basemaps.md).

The app will use MapLibre-compatible vector maps with free providers as the initial map rendering path. This preserves provider independence and alignment with free/open map data while still supporting a polished mobile map experience; proprietary map SDKs may be easier in the short term, but would create avoidable lock-in around rendering, styling, and data sources.
