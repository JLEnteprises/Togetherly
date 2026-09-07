CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assign_to_both boolean NOT NULL DEFAULT true,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  due_at timestamptz,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_couple_status_idx ON tasks(couple_id, status, due_at);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_couple_updated_idx ON notes(couple_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_private_creator_idx ON notes(creator_id, visibility) WHERE visibility = 'private';

CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lists_couple_updated_idx ON lists(couple_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS list_items (
  id uuid PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  notes text NOT NULL DEFAULT '',
  link text,
  completed boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS list_items_list_idx ON list_items(list_id, completed, created_at);

CREATE TABLE IF NOT EXISTS countdowns (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  target_at timestamptz NOT NULL,
  start_at timestamptz,
  type text NOT NULL DEFAULT 'custom' CHECK (type IN ('visit', 'flight', 'anniversary', 'birthday', 'moving', 'wedding', 'holiday', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS countdowns_couple_target_idx ON countdowns(couple_id, target_at);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_couple_name_unique ON tags(couple_id, lower(name));
