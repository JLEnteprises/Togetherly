-- Togetherly Release D1: persistent emotional acknowledgements and daily-question reveal state.

CREATE TABLE IF NOT EXISTS mood_acknowledgements (
  mood_id uuid NOT NULL REFERENCES moods(id) ON DELETE CASCADE,
  acknowledger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mood_id, acknowledger_user_id)
);
CREATE INDEX IF NOT EXISTS mood_acknowledgements_user_idx
  ON mood_acknowledgements(acknowledger_user_id, acknowledged_at DESC);

CREATE TABLE IF NOT EXISTS daily_question_reveals (
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, question_id, answer_date, user_id)
);
CREATE INDEX IF NOT EXISTS daily_question_reveals_user_idx
  ON daily_question_reveals(user_id, answer_date DESC);
