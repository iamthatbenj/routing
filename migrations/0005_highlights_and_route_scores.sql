CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  strength INTEGER NOT NULL,
  visit_effort TEXT NOT NULL,
  endpoint_context_place_id TEXT REFERENCES routing_places (id),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS highlight_h3_cells (
  highlight_id TEXT NOT NULL REFERENCES highlights (id) ON DELETE CASCADE,
  resolution INTEGER NOT NULL,
  cell TEXT NOT NULL,
  PRIMARY KEY (highlight_id, resolution, cell)
);

CREATE INDEX IF NOT EXISTS highlight_h3_cells_lookup_idx ON highlight_h3_cells (resolution, cell);

ALTER TABLE route_options ADD COLUMN interest_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE route_options ADD COLUMN explanation_json TEXT NOT NULL DEFAULT '[]';

INSERT OR IGNORE INTO highlights (id, name, category, latitude, longitude, strength, visit_effort, endpoint_context_place_id, description)
VALUES
  ('rocky-mountain-national-park', 'Rocky Mountain National Park', 'nature', 40.3428, -105.6836, 95, 'Full Day+', NULL, 'Major mountain Nature Highlight north of Denver.'),
  ('colorado-national-monument', 'Colorado National Monument', 'nature', 39.1008, -108.7335, 82, 'Half Day', NULL, 'Red-rock canyon Nature Highlight near Grand Junction.'),
  ('dinosaur-national-monument', 'Dinosaur National Monument', 'nature', 40.5070, -108.9330, 76, 'Half Day', NULL, 'Northern fossil and canyon Nature Highlight.'),
  ('black-canyon-of-the-gunnison', 'Black Canyon of the Gunnison', 'nature', 38.5543, -107.6866, 84, 'Half Day', NULL, 'Southern canyon Nature Highlight.'),
  ('glenwood-canyon', 'Glenwood Canyon', 'scenic_segment', 39.5658, -107.3233, 70, 'Quick Stop', NULL, 'Scenic Segment along the I-70 corridor.'),
  ('arches-national-park', 'Arches National Park', 'nature', 38.7331, -109.5925, 96, 'Full Day+', 'moab-ut', 'Moab destination-context Nature Highlight.'),
  ('canyonlands-national-park', 'Canyonlands National Park', 'nature', 38.3269, -109.8783, 94, 'Full Day+', 'moab-ut', 'Moab destination-context Nature Highlight.');

INSERT OR IGNORE INTO highlight_h3_cells (highlight_id, resolution, cell)
VALUES
  ('rocky-mountain-national-park', 5, '8526819bfffffff'),
  ('colorado-national-monument', 5, '85269ccffffffff'),
  ('dinosaur-national-monument', 5, '852682dbfffffff'),
  ('black-canyon-of-the-gunnison', 5, '85269dcbfffffff'),
  ('glenwood-canyon', 5, '8526831bfffffff'),
  ('arches-national-park', 5, '85269e8ffffffff'),
  ('canyonlands-national-park', 5, '85269e0bfffffff');
