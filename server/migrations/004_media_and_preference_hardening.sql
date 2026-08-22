-- Additive hardening so this release remains safe if an earlier v1.0 draft was migrated.
ALTER TABLE couples ADD COLUMN IF NOT EXISTS disabled_question_categories text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS high_contrast boolean NOT NULL DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_events boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_partner_mood boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_goal_milestones boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_memories boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notification_visit_approaching boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key text NOT NULL UNIQUE,
  original_name text,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 6291456),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_files_couple_idx ON media_files(couple_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_media (
  id uuid PRIMARY KEY,
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (memory_id, media_id)
);
CREATE INDEX IF NOT EXISTS memory_media_memory_idx ON memory_media(memory_id, sort_order, created_at);
