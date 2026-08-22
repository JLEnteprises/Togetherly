-- Togetherly v1.5: Play Together shared game sessions.

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  game_type text NOT NULL CHECK (game_type IN ('bingo', 'hangman', 'this_or_that', 'know_me')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  reward text NOT NULL DEFAULT '' CHECK (char_length(reward) <= 300),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_sessions_couple_idx
  ON game_sessions(couple_id, status, updated_at DESC);
