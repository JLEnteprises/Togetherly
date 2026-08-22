-- Togetherly v1.7: creative drawing support and smarter task timing.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_estimated_minutes_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_estimated_minutes_check CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 5256000);
CREATE INDEX IF NOT EXISTS tasks_couple_start_due_idx ON tasks(couple_id, start_date, due_date) WHERE status NOT IN ('completed','skipped');

ALTER TABLE task_subtasks ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE task_subtasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE task_subtasks DROP CONSTRAINT IF EXISTS task_subtasks_estimated_minutes_check;
ALTER TABLE task_subtasks ADD CONSTRAINT task_subtasks_estimated_minutes_check CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 5256000);

ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon_drawing jsonb;

ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN ('bingo', 'hangman', 'this_or_that', 'know_me', 'draw_together'));
