-- Additive experience changes. Existing events, memories, and check-ins remain valid.
CREATE TABLE IF NOT EXISTS date_proposals (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  proposer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  revision integer NOT NULL DEFAULT 1,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS date_proposals_couple ON date_proposals(couple_id, start_at);
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_trip_id uuid REFERENCES trips(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS memory_reflections (
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(memory_id,user_id)
);
ALTER TABLE moods ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '';
ALTER TABLE moods ADD COLUMN IF NOT EXISTS valid_until timestamptz;
CREATE TABLE IF NOT EXISTS time_capsules (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  photo_url text,
  opens_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS time_capsules_couple ON time_capsules(couple_id, opens_at);
