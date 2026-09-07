-- Togetherly v1.3: recurring tasks, subtasks, linked trip planning,
-- multi-photo memories/albums, and long-distance availability windows.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date date;
UPDATE tasks SET due_date = due_at::date WHERE due_date IS NULL AND due_at IS NOT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS occurrence_number integer NOT NULL DEFAULT 1;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IN ('none', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly'));
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_occurrence_number_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_occurrence_number_check CHECK (occurrence_number > 0);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_series_idx ON tasks(series_id, occurrence_number) WHERE series_id IS NOT NULL;


-- Preserve all-day calendar dates as timezone-free values. The timestamp columns
-- remain for timed events/reminders, while clients render all-day events from
-- these DATE columns so a date does not shift for the partner in another zone.
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date date;
UPDATE events SET start_date=start_at::date WHERE all_day=true AND start_date IS NULL;
UPDATE events SET end_date=end_at::date WHERE all_day=true AND end_at IS NOT NULL AND end_date IS NULL;

CREATE TABLE IF NOT EXISTS task_subtasks (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_subtasks_task_idx ON task_subtasks(task_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS trip_links (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('list', 'goal', 'countdown', 'event')),
  entity_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS trip_links_entity_idx ON trip_links(entity_type, entity_id);

-- v1.2 created the media relation ahead of the UI. v1.3 allows the current
-- authenticated data-URL/URL storage path to occupy it directly while keeping
-- media_id available for a future object-storage migration.
ALTER TABLE memory_media ALTER COLUMN media_id DROP NOT NULL;
ALTER TABLE memory_media ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE memory_media DROP CONSTRAINT IF EXISTS memory_media_has_source;
ALTER TABLE memory_media ADD CONSTRAINT memory_media_has_source CHECK (media_id IS NOT NULL OR media_url IS NOT NULL);

CREATE TABLE IF NOT EXISTS memory_albums (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_albums_couple_idx ON memory_albums(couple_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_album_items (
  album_id uuid NOT NULL REFERENCES memory_albums(id) ON DELETE CASCADE,
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, memory_id)
);
CREATE INDEX IF NOT EXISTS memory_album_items_memory_idx ON memory_album_items(memory_id);

CREATE TABLE IF NOT EXISTS user_schedules (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('free', 'work', 'sleep', 'busy')),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute <> start_minute)
);
CREATE INDEX IF NOT EXISTS user_schedules_couple_idx ON user_schedules(couple_id, user_id, day_of_week, start_minute);
