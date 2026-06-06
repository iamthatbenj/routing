CREATE TABLE IF NOT EXISTS route_searches (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  from_trip_stop_id TEXT NOT NULL REFERENCES trip_stops (id) ON DELETE CASCADE,
  to_trip_stop_id TEXT NOT NULL REFERENCES trip_stops (id) ON DELETE CASCADE,
  directness TEXT NOT NULL DEFAULT 'Balanced',
  status TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS route_searches_trip_leg_idx
  ON route_searches (trip_id, from_trip_stop_id, to_trip_stop_id, created_at);

CREATE TABLE IF NOT EXISTS route_options (
  id TEXT PRIMARY KEY,
  route_search_id TEXT NOT NULL REFERENCES route_searches (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  distance_meters INTEGER NOT NULL,
  geometry_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS route_options_search_order_idx
  ON route_options (route_search_id, sort_order);
