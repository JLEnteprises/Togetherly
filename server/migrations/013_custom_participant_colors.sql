-- Togetherly Release A: custom participant identity colours.
-- Existing Purple/Green couples keep the same visual colours, now stored as hex.

ALTER TABLE couple_members DROP CONSTRAINT IF EXISTS couple_members_participant_color_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_participant_color_check;

UPDATE couple_members
SET participant_color = CASE lower(participant_color)
  WHEN 'purple' THEN '#BE9AFF'
  WHEN 'green' THEN '#B7CB7C'
  ELSE upper(participant_color)
END
WHERE participant_color IS NOT NULL;

UPDATE users
SET preferred_participant_color = CASE lower(preferred_participant_color)
  WHEN 'purple' THEN '#BE9AFF'
  WHEN 'green' THEN '#B7CB7C'
  ELSE upper(preferred_participant_color)
END
WHERE preferred_participant_color IS NOT NULL;

ALTER TABLE couple_members ADD CONSTRAINT couple_members_participant_color_check
  CHECK (participant_color IS NULL OR participant_color ~ '^#[0-9A-F]{6}$');

ALTER TABLE users ADD CONSTRAINT users_preferred_participant_color_check
  CHECK (preferred_participant_color IS NULL OR preferred_participant_color ~ '^#[0-9A-F]{6}$');
