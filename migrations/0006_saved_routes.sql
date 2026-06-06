CREATE TABLE IF NOT EXISTS saved_routes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  from_trip_stop_id TEXT NOT NULL REFERENCES trip_stops (id) ON DELETE CASCADE,
  to_trip_stop_id TEXT NOT NULL REFERENCES trip_stops (id) ON DELETE CASCADE,
  route_option_id TEXT REFERENCES route_options (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  is_preferred INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS saved_routes_trip_leg_idx
  ON saved_routes (trip_id, from_trip_stop_id, to_trip_stop_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS saved_routes_one_preferred_per_leg_idx
  ON saved_routes (trip_id, from_trip_stop_id, to_trip_stop_id)
  WHERE is_preferred = 1;
