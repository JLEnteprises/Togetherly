-- Togetherly v1.0 feature-complete MVP schema.

ALTER TABLE couples ADD COLUMN IF NOT EXISTS disabled_question_categories text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE couple_members ADD COLUMN IF NOT EXISTS participant_color text;
WITH ranked AS (
  SELECT couple_id, user_id,
         row_number() OVER (PARTITION BY couple_id ORDER BY joined_at ASC, user_id ASC) AS rn
  FROM couple_members
)
UPDATE couple_members cm
SET participant_color = CASE WHEN ranked.rn = 1 THEN 'purple' ELSE 'green' END
FROM ranked
WHERE cm.couple_id = ranked.couple_id
  AND cm.user_id = ranked.user_id
  AND cm.participant_color IS NULL;
ALTER TABLE couple_members DROP CONSTRAINT IF EXISTS couple_members_participant_color_check;
ALTER TABLE couple_members ADD CONSTRAINT couple_members_participant_color_check CHECK (participant_color IN ('purple', 'green'));
CREATE UNIQUE INDEX IF NOT EXISTS couple_members_color_unique ON couple_members(couple_id, participant_color) WHERE participant_color IS NOT NULL;

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assign_to_both boolean NOT NULL DEFAULT true,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text NOT NULL DEFAULT '',
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS events_couple_start_idx ON events(couple_id, start_at);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  target_value numeric(14,2) NOT NULL CHECK (target_value > 0),
  unit text NOT NULL DEFAULT '',
  deadline date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_couple_status_idx ON goals(couple_id, status, deadline);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id uuid PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx ON goal_contributions(goal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  destination text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS trips_couple_start_idx ON trips(couple_id, start_date);

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  memory_date date NOT NULL,
  location text NOT NULL DEFAULT '',
  is_milestone boolean NOT NULL DEFAULT false,
  emoji text NOT NULL DEFAULT '✦',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_couple_date_idx ON memories(couple_id, memory_date DESC);
CREATE INDEX IF NOT EXISTS memories_milestone_idx ON memories(couple_id, memory_date) WHERE is_milestone = true;

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '',
  cost_level text NOT NULL DEFAULT 'free' CHECK (cost_level IN ('free', 'cheap', 'moderate', 'expensive')),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  location_type text NOT NULL DEFAULT 'anywhere' CHECK (location_type IN ('home', 'nearby', 'online', 'anywhere')),
  location text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'either' CHECK (environment IN ('indoor', 'outdoor', 'either')),
  time_of_day text NOT NULL DEFAULT 'any' CHECK (time_of_day IN ('morning', 'day', 'night', 'any')),
  mood text NOT NULL DEFAULT 'any' CHECK (mood IN ('relaxing', 'romantic', 'adventurous', 'active', 'lazy', 'silly', 'any')),
  status text NOT NULL DEFAULT 'want_to_do' CHECK (status IN ('want_to_do', 'planned', 'completed', 'favourite', 'do_again', 'skip')),
  kid_friendly boolean NOT NULL DEFAULT false,
  booking_required boolean NOT NULL DEFAULT false,
  rating smallint CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  last_rejected_at timestamptz,
  last_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_couple_status_idx ON activities(couple_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS activity_interests (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interested boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY,
  question text NOT NULL UNIQUE,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_answers (
  id uuid PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 4000),
  answer_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id, answer_date)
);
CREATE INDEX IF NOT EXISTS question_answers_couple_date_idx ON question_answers(couple_id, answer_date DESC);

CREATE TABLE IF NOT EXISTS moods (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  mood text NOT NULL CHECK (mood IN ('amazing', 'good', 'okay', 'low', 'frustrated', 'overwhelmed', 'tired', 'stressed')),
  need text NOT NULL DEFAULT 'nothing' CHECK (need IN ('affection', 'reassurance', 'advice', 'listen', 'distraction', 'space', 'call', 'nothing')),
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moods_couple_created_idx ON moods(couple_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_tags (
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'note', 'list', 'event', 'goal', 'memory', 'activity', 'trip')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS content_tags_entity_idx ON content_tags(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reduced_motion boolean NOT NULL DEFAULT false,
  haptics boolean NOT NULL DEFAULT true,
  high_contrast boolean NOT NULL DEFAULT false,
  notification_events boolean NOT NULL DEFAULT true,
  notification_tasks boolean NOT NULL DEFAULT true,
  notification_countdowns boolean NOT NULL DEFAULT true,
  notification_partner_activity boolean NOT NULL DEFAULT true,
  notification_daily_question boolean NOT NULL DEFAULT true,
  notification_partner_mood boolean NOT NULL DEFAULT true,
  notification_goal_milestones boolean NOT NULL DEFAULT true,
  notification_memories boolean NOT NULL DEFAULT true,
  notification_visit_approaching boolean NOT NULL DEFAULT true,
  backdrop_theme text NOT NULL DEFAULT 'dual_orbit' CHECK (backdrop_theme IN ('dual_orbit', 'minimal_night', 'cottagecore', 'gothic', 'warm_light')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO questions(id, question, category) VALUES
  ('10000000-0000-4000-8000-000000000001', 'What tiny thing does your partner do that you love?', 'cute'),
  ('10000000-0000-4000-8000-000000000002', 'What is one memory with us that you would happily relive tomorrow?', 'memories'),
  ('10000000-0000-4000-8000-000000000003', 'What is something you want us to experience together this year?', 'future'),
  ('10000000-0000-4000-8000-000000000004', 'What makes you feel most cared for when you have had a hard day?', 'relationship'),
  ('10000000-0000-4000-8000-000000000005', 'What is a ridiculous thing we would probably be great at as a team?', 'funny'),
  ('10000000-0000-4000-8000-000000000006', 'What part of your childhood would you most like to show me?', 'childhood'),
  ('10000000-0000-4000-8000-000000000007', 'If we could wake up anywhere together tomorrow, where would it be?', 'hypothetical'),
  ('10000000-0000-4000-8000-000000000008', 'What is one thing about our future that you are quietly excited about?', 'romantic'),
  ('10000000-0000-4000-8000-000000000009', 'Would you rather plan the perfect date together or surprise each other?', 'would_you_rather'),
  ('10000000-0000-4000-8000-000000000010', 'What helps you feel closest to me when we are apart?', 'deep'),
  ('10000000-0000-4000-8000-000000000011', 'What is something new you would like us to try together?', 'relationship'),
  ('10000000-0000-4000-8000-000000000012', 'What compliment from me has stuck with you the most?', 'cute'),
  ('10000000-0000-4000-8000-000000000013', 'What ordinary future moment are you most looking forward to sharing?', 'future'),
  ('10000000-0000-4000-8000-000000000014', 'What is one way we have changed each other for the better?', 'deep'),
  ('10000000-0000-4000-8000-000000000015', 'What kind of affection makes you feel most connected to me?', 'intimacy')
ON CONFLICT (question) DO NOTHING;
