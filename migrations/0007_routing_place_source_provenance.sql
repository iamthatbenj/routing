ALTER TABLE routing_places ADD COLUMN source_system TEXT NOT NULL DEFAULT 'app_seed';
ALTER TABLE routing_places ADD COLUMN source_dataset TEXT NOT NULL DEFAULT 'initial_seed';
ALTER TABLE routing_places ADD COLUMN source_record_id TEXT NOT NULL DEFAULT '';
ALTER TABLE routing_places ADD COLUMN source_provenance_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE routing_places ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE routing_places
SET updated_at = created_at
WHERE updated_at = '';

CREATE INDEX IF NOT EXISTS routing_places_source_idx
ON routing_places (source_system, source_dataset, source_record_id);
