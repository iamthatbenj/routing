ALTER TABLE trips ADD COLUMN share_token TEXT;

UPDATE trips
SET share_token = lower(hex(randomblob(32)))
WHERE share_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trips_share_token_idx ON trips (share_token);
