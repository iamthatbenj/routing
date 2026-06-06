CREATE TABLE IF NOT EXISTS routing_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  kind TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  search_label TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trip_stops (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  routing_place_id TEXT NOT NULL REFERENCES routing_places (id),
  position INTEGER NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (trip_id, position)
);

CREATE INDEX IF NOT EXISTS trip_stops_trip_position_idx ON trip_stops (trip_id, position);

INSERT OR IGNORE INTO routing_places (id, name, region, kind, latitude, longitude, search_label)
VALUES
  ('denver-co', 'Denver', 'Colorado', 'city', 39.7392, -104.9903, 'Denver, Colorado'),
  ('moab-ut', 'Moab', 'Utah', 'city', 38.5733, -109.5498, 'Moab, Utah'),
  ('rocky-mountain-national-park-co', 'Rocky Mountain National Park', 'Colorado', 'national_park', 40.3428, -105.6836, 'Rocky Mountain National Park, Colorado'),
  ('colorado-national-monument-co', 'Colorado National Monument', 'Colorado', 'national_monument', 39.1008, -108.7335, 'Colorado National Monument, Colorado'),
  ('dinosaur-national-monument-ut-co', 'Dinosaur National Monument', 'Utah / Colorado', 'national_monument', 40.5070, -108.9330, 'Dinosaur National Monument, Utah / Colorado'),
  ('black-canyon-of-the-gunnison-co', 'Black Canyon of the Gunnison', 'Colorado', 'national_park', 38.5543, -107.6866, 'Black Canyon of the Gunnison, Colorado');
