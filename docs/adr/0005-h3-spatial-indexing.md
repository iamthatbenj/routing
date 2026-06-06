# Use H3 indexes for route-to-Highlight spatial matching

Route-to-Highlight spatial matching will use precomputed H3 indexes in Turso for the initial implementation. Highlight locations can be assigned to H3 cells and route geometries can be expanded into corridor cells for nearby matching, avoiding an immediate move to PostGIS while accepting less expressive spatial querying and the need to tune resolutions and corridor expansion carefully.
