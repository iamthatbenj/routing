# Use Turso as the initial primary database

The app will use Turso as the initial primary database for application data, Highlight metadata, the city gazetteer, route snapshots, Trips, and Saved Routes. This builds on the existing OSM-derived POI data already hosted in Turso and keeps early operations simple, while accepting that spatial-heavy route scoring may require precomputed indexes or a later dedicated spatial store rather than relying on PostGIS from the start.
