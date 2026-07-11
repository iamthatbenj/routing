ALTER TABLE highlights ADD COLUMN candidate_highlight_id TEXT REFERENCES candidate_highlights (id);
ALTER TABLE highlights ADD COLUMN source_provenance_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE highlights ADD COLUMN reviewed_at TEXT;
ALTER TABLE highlights ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE highlights
SET updated_at = created_at
WHERE updated_at = '';

CREATE INDEX IF NOT EXISTS highlights_candidate_highlight_idx
ON highlights (candidate_highlight_id);
