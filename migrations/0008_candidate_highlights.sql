CREATE TABLE IF NOT EXISTS candidate_highlights (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  proposed_category TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_url TEXT,
  source_category TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'imported',
  ambiguity_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_system, source_database, source_record_id)
);

CREATE INDEX IF NOT EXISTS candidate_highlights_source_idx
ON candidate_highlights (source_system, source_database, source_record_id);

CREATE INDEX IF NOT EXISTS candidate_highlights_status_idx
ON candidate_highlights (status, proposed_category);
