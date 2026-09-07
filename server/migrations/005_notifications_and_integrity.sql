-- Access-token revocation version. Password reset increments this so previously
-- issued short-lived access tokens stop working immediately, not just refresh tokens.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;

-- In-app notifications and integrity constraints for the feature-complete MVP.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('partner_activity','task','event','countdown','daily_question','mood','goal','memory','visit')),
  entity_type text,
  entity_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_couple_idx ON notifications(couple_id, created_at DESC);

-- Assignment rows must always describe exactly one of "both" or one user.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignment_consistency;
ALTER TABLE tasks ADD CONSTRAINT tasks_assignment_consistency CHECK (
  (assign_to_both = true AND assignee_id IS NULL) OR
  (assign_to_both = false AND assignee_id IS NOT NULL)
);
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_assignment_consistency;
ALTER TABLE events ADD CONSTRAINT events_assignment_consistency CHECK (
  (assign_to_both = true AND assigned_user_id IS NULL) OR
  (assign_to_both = false AND assigned_user_id IS NOT NULL)
);

-- A countdown progress window only makes sense when the start precedes the target.
ALTER TABLE countdowns DROP CONSTRAINT IF EXISTS countdowns_start_before_target;
ALTER TABLE countdowns ADD CONSTRAINT countdowns_start_before_target CHECK (start_at IS NULL OR start_at < target_at);
