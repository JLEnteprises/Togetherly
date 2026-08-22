ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_mode text NOT NULL DEFAULT 'automatic';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_timezone_mode_check;
ALTER TABLE users ADD CONSTRAINT users_timezone_mode_check CHECK (timezone_mode IN ('automatic','manual'));

CREATE TABLE IF NOT EXISTS live_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sharing_enabled boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  captured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK (accuracy_m IS NULL OR accuracy_m >= 0)
);
CREATE INDEX IF NOT EXISTS live_locations_couple_idx ON live_locations(couple_id, updated_at DESC);
