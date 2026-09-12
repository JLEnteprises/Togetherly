-- Receipt and content mutation commit atomically. Keep receipts so a device
-- returning after a long absence cannot replay an already accepted creation.
CREATE TABLE IF NOT EXISTS offline_receipts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id text NOT NULL,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);
