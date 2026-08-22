CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS couples (
  id uuid PRIMARY KEY,
  relationship_start_date date,
  anniversary_date date,
  photo_url text,
  theme text NOT NULL DEFAULT 'default',
  long_distance_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS couple_members (
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS couple_members_couple_idx ON couple_members(couple_id);

CREATE TABLE IF NOT EXISTS couple_invites (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  invite_code varchar(8) NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS couple_invites_couple_idx ON couple_invites(couple_id);
CREATE INDEX IF NOT EXISTS couple_invites_active_idx ON couple_invites(couple_id, expires_at) WHERE accepted_at IS NULL;

CREATE TABLE IF NOT EXISTS shared_items (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('note', 'task')),
  shared_key text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_items_couple_idx ON shared_items(couple_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS shared_items_key_unique ON shared_items(couple_id, shared_key) WHERE shared_key IS NOT NULL;
