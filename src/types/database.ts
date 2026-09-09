export type ParticipantColor = string;

export type DrawingPoint = { x: number; y: number };
export type DrawingStroke = { id: string; userId?: string; points: DrawingPoint[]; width?: number; color?: string; opacity?: number; tool?: 'pen' | 'marker' | 'highlighter' | 'eraser' };
export type DrawingData = { version: 1; strokes: DrawingStroke[] };

export type Tag = {
  id: string;
  couple_id: string;
  creator_id: string;
  name: string;
  icon: string | null;
  icon_drawing?: DrawingData | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  timezone_mode: 'automatic' | 'manual';
  onboarding_complete: boolean;
  preferred_participant_color: ParticipantColor | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Couple = {
  id: string;
  relationship_start_date: string | null;
  anniversary_date: string | null;
  photo_url: string | null;
  theme: string;
  long_distance_enabled: boolean;
  shared_day_timezone: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CoupleInvite = {
  id: string;
  couple_id: string;
  invite_code: string;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

export type SharedItem = {
  id: string;
  couple_id: string;
  creator_id: string;
  updated_by: string;
  item_type: 'note' | 'task';
  shared_key: string | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
export type Priority = 'low' | 'normal' | 'high';

export type TaskSubtask = {
  id: string;
  task_id: string;
  creator_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CoupleTask = {
  id: string;
  couple_id: string;
  creator_id: string;
  assignee_id: string | null;
  assignee_name?: string | null;
  assign_to_both: boolean;
  title: string;
  description: string;
  due_at: string | null;
  due_date: string | null;
  start_date: string | null;
  estimated_minutes: number | null;
  priority: Priority;
  status: TaskStatus;
  recurrence: TaskRecurrence;
  series_id: string | null;
  occurrence_number: number;
  subtasks?: TaskSubtask[];
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type CoupleNote = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  body: string;
  visibility: 'shared' | 'private';
  pinned: boolean;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type CoupleList = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  item_count?: number;
  completed_count?: number;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type CoupleListItem = {
  id: string;
  list_id: string;
  creator_id: string;
  title: string;
  notes: string;
  link: string | null;
  completed: boolean;
  priority: Priority;
  created_at: string;
  updated_at: string;
};

export type CountdownType = 'visit' | 'flight' | 'anniversary' | 'birthday' | 'moving' | 'wedding' | 'holiday' | 'custom';
export type CoupleCountdown = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  target_at: string;
  start_at: string | null;
  type: CountdownType;
  created_at: string;
  updated_at: string;
};

export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CoupleEvent = {
  id: string;
  couple_id: string;
  creator_id: string;
  assigned_user_id: string | null;
  assigned_user_name?: string | null;
  assign_to_both: boolean;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  start_date?: string | null;
  end_date?: string | null;
  all_day: boolean;
  location: string;
  recurrence: EventRecurrence;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type GoalStatus = 'active' | 'paused' | 'completed';
export type GoalContribution = { id: string; creator_id: string; amount: number | string; note: string; created_at: string };
export type CoupleGoal = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  description: string;
  current_value: number | string;
  target_value: number | string;
  unit: string;
  deadline: string | null;
  status: GoalStatus;
  tags?: Tag[];
  contributions?: GoalContribution[];
  created_at: string;
  updated_at: string;
};

export type TripLinkType = 'list' | 'goal' | 'countdown' | 'event';
export type TripLink = { entity_type: TripLinkType; entity_id: string; created_by: string; created_at: string; managed_by_trip: boolean; title: string; subtitle: string };

export type CoupleTrip = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  link_count?: number;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type MemoryPhoto = { id: string | null; media_url: string; caption: string; sort_order: number };
export type MemoryAlbum = { id: string; couple_id: string; creator_id: string; title: string; description: string; memory_count?: number; cover_url?: string | null; created_at: string; updated_at: string };

export type CoupleMemory = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  description: string;
  memory_date: string;
  location: string;
  is_milestone: boolean;
  emoji: string;
  photo_url: string | null;
  photos?: MemoryPhoto[];
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type ActivityCost = 'free' | 'cheap' | 'moderate' | 'expensive';
export type ActivityLocationType = 'home' | 'nearby' | 'online' | 'anywhere';
export type ActivityEnvironment = 'indoor' | 'outdoor' | 'either';
export type ActivityTime = 'morning' | 'day' | 'night' | 'any';
export type ActivityMood = 'relaxing' | 'romantic' | 'adventurous' | 'active' | 'lazy' | 'silly' | 'any';
export type ActivityStatus = 'want_to_do' | 'planned' | 'completed' | 'do_again' | 'skip';
export type CoupleActivity = {
  id: string;
  couple_id: string;
  creator_id: string;
  title: string;
  description: string;
  cost_level: ActivityCost;
  duration_minutes: number | null;
  location_type: ActivityLocationType;
  location: string;
  environment: ActivityEnvironment;
  time_of_day: ActivityTime;
  mood: ActivityMood;
  status: ActivityStatus;
  is_favourite: boolean;
  kid_friendly: boolean;
  booking_required: boolean;
  rating: number | null;
  last_rejected_at: string | null;
  last_completed_at: string | null;
  interests?: Record<string, boolean>;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
};

export type DailyQuestion = { id: string; question: string; category: string };
export type QuestionAnswer = { id: string; question_id: string; user_id: string; couple_id: string; answer: string; answer_date: string; display_name?: string; created_at: string; updated_at: string };
export type DailyQuestionState = {
  question: DailyQuestion | null;
  date?: string;
  dayTimeZone?: string;
  myAnswer: QuestionAnswer | null;
  partnerAnswer: QuestionAnswer | null;
  bothAnswered: boolean;
  waitingForPartner?: boolean;
  disabledCategories?: string[];
};
export type DailyQuestionHistoryEntry = { date: string; question: DailyQuestion; myAnswer: QuestionAnswer; partnerAnswer: QuestionAnswer | null; bothAnswered: boolean };

export type MoodValue = 'amazing' | 'good' | 'okay' | 'low' | 'frustrated' | 'overwhelmed' | 'tired' | 'stressed';
export type NeedValue = 'affection' | 'reassurance' | 'advice' | 'listen' | 'distraction' | 'space' | 'call' | 'nothing';
export type MoodEntry = { id: string; user_id: string; couple_id: string; mood: MoodValue; need: NeedValue; visibility: 'shared' | 'private'; created_at: string };

export type UserPreferences = {
  user_id: string;
  reduced_motion: boolean;
  haptics: boolean;
  high_contrast: boolean;
  notification_events: boolean;
  notification_tasks: boolean;
  notification_countdowns: boolean;
  notification_partner_activity: boolean;
  notification_daily_question: boolean;
  notification_partner_mood: boolean;
  notification_goal_milestones: boolean;
  notification_memories: boolean;
  notification_visit_approaching: boolean;
  notification_relationship_pings: boolean;
  backdrop_theme: 'dual_orbit' | 'minimal_night' | 'cottagecore' | 'gothic' | 'warm_light';
  created_at: string;
  updated_at: string;
};

export type SearchResult = {
  type: 'task' | 'note' | 'list' | 'event' | 'goal' | 'memory' | 'activity' | 'trip' | 'countdown';
  id: string;
  title: string;
  subtitle: string;
  creator_id: string;
  sort_at: string;
};

export type ScheduleKind = 'free' | 'work' | 'sleep' | 'busy';
export type ScheduleWindow = {
  id: string; couple_id: string; user_id: string; label: string; kind: ScheduleKind; day_of_week: number; start_minute: number; end_minute: number; enabled: boolean;
  display_name?: string; timezone?: string; participant_color?: ParticipantColor; created_at: string; updated_at: string;
};
export type AvailabilityOverlap = { startAt: string; endAt: string; durationMinutes: number };

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type AuthSession = AuthTokens & { user: Profile };

export type WorkspaceSnapshot = {
  profile: Profile;
  couple: Couple | null;
  activeInvite: CoupleInvite | null;
  memberCount: number;
  partnerProfile: Profile | null;
  myColor: ParticipantColor | null;
  partnerColor: ParticipantColor | null;
};

export type InAppNotification = {
  id: string;
  couple_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  actor_name?: string | null;
  kind: 'partner_activity' | 'task' | 'event' | 'countdown' | 'daily_question' | 'mood' | 'goal' | 'memory' | 'visit' | 'love' | 'thinking_of_you';
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};


export type PushDevice = {
  id: string;
  platform: 'ios' | 'android';
  device_name: string;
  active: boolean;
  last_seen_at: string;
  created_at: string;
};

export type WatchPartnerMood = { id: string; mood: MoodValue; need: NeedValue; created_at: string } | null;
export type WatchState = {
  serverTime: string;
  me: { id: string; name: string; color: ParticipantColor };
  partner: {
    id: string; name: string; color: ParticipantColor; timezone: string; localTime: string;
    status: { kind: string; label: string | null } | null;
    mood: WatchPartnerMood;
  };
  relationship: { days: number | null; startDate: string | null; anniversaryDate: string | null; longDistance: boolean };
  nextVisit: { id: string; title: string; target_at: string; type: string } | null;
  dailyQuestion: { question: { id: string; question: string; category: string } | null; meAnswered: boolean; partnerAnswered: boolean; bothAnswered: boolean };
};

export type WatchSession = { token: string; expiresAt: string; deviceName: string };

export type GameType = 'bingo' | 'hangman' | 'this_or_that' | 'know_me' | 'draw_together';
export type GameStatus = 'active' | 'completed' | 'abandoned';
export type BingoWinCondition = 'line' | 'two_lines' | 'four_corners' | 'full';
export type BingoSquare = { id: string; text: string; kind: 'claim' | 'partner'; completed?: boolean; pending?: boolean; blockedUntil?: string | null };
export type BingoGameState = { members: string[]; winCondition: BingoWinCondition; longDistance?: boolean; cards: Record<string, BingoSquare[]> };
export type HangmanGameState = { members: string[]; hostUserId: string; guesserUserId: string; secretWord?: string; maskedWord: string; guesses: string[]; wrongGuesses: number; maxWrong: number };
export type ThisOrThatRound = { question: string; left: string; right: string };
export type ThisOrThatGameState = { members: string[]; rounds: ThisOrThatRound[]; index: number; answers: Record<string, Record<string, 'left' | 'right'>>; matches: number; currentRevealed?: boolean };
export type KnowMeRound = { question: string; choices: string[]; subjectUserId: string };
export type KnowMeGameState = { members: string[]; rounds: KnowMeRound[]; index: number; answers: Record<string, { subject?: number; guess?: number }>; scores: Record<string, number>; currentRevealed?: boolean; subjectLocked?: boolean };
export type DrawTogetherGameState = { members: string[]; strokes: DrawingStroke[] };
export type GameSession = {
  id: string;
  couple_id: string;
  creator_id: string;
  game_type: GameType;
  status: GameStatus;
  title: string;
  reward: string;
  settings: Record<string, unknown>;
  state: BingoGameState | HangmanGameState | ThisOrThatGameState | KnowMeGameState | DrawTogetherGameState;
  winner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveLocationMember = {
  userId: string;
  displayName: string;
  participantColor: ParticipantColor;
  sharingEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  capturedAt: string | null;
};
