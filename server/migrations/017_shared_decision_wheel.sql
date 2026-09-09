-- Togetherly Release D3: shared server-authoritative decision wheel.

CREATE TABLE IF NOT EXISTS decision_wheels (
  couple_id uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner text,
  winner_index integer,
  spin_id uuid,
  spin_count integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  spun_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_wheel_spins (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  spun_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  options jsonb NOT NULL,
  winner text NOT NULL,
  winner_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_wheel_spins_couple_idx
  ON decision_wheel_spins(couple_id, created_at DESC);
