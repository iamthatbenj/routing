ALTER TABLE route_searches ADD COLUMN provider TEXT NOT NULL DEFAULT 'ors';
ALTER TABLE route_searches ADD COLUMN diagnostic_json TEXT NOT NULL DEFAULT '{}';
