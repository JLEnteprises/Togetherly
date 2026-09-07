-- Togetherly v1.14: device push delivery + Apple Watch companion support.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_relationship_pings boolean NOT NULL DEFAULT true;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN ('partner_activity','task','event','countdown','daily_question','mood','goal','memory','visit','love','thinking_of_you')
);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 20 AND 500),
  provider text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo')),
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  device_name text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx ON device_push_tokens(user_id, active, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS watch_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_name text NOT NULL DEFAULT 'Apple Watch',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_sessions_user_idx ON watch_sessions(user_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS relationship_pings (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('love','thinking_of_you')),
  source text NOT NULL DEFAULT 'phone' CHECK (source IN ('phone','watch','widget')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relationship_pings_couple_idx ON relationship_pings(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS relationship_pings_recipient_idx ON relationship_pings(recipient_user_id, created_at DESC);
