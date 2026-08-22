-- Togetherly v1.2: real-user onboarding, lifecycle and reminder hardening.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_participant_color text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_participant_color_check;
ALTER TABLE users ADD CONSTRAINT users_preferred_participant_color_check
  CHECK (preferred_participant_color IS NULL OR preferred_participant_color IN ('purple', 'green'));

-- Preserve established Purple/Green identity for accounts upgrading from earlier builds.
UPDATE users u
SET preferred_participant_color = cm.participant_color
FROM couple_members cm
WHERE cm.user_id = u.id
  AND u.preferred_participant_color IS NULL
  AND cm.participant_color IN ('purple', 'green');

ALTER TABLE couples ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
UPDATE couples c
SET owner_user_id = ranked.user_id
FROM (
  SELECT DISTINCT ON (couple_id) couple_id, user_id
  FROM couple_members
  ORDER BY couple_id, joined_at ASC, user_id ASC
) ranked
WHERE c.id = ranked.couple_id AND c.owner_user_id IS NULL;
CREATE INDEX IF NOT EXISTS couples_owner_idx ON couples(owner_user_id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_dedupe_unique
  ON notifications(recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
