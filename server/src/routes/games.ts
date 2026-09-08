import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, oneOf, optionalText, requireCoupleId, requiredText } from './helpers.js';

type GameType = 'bingo' | 'hangman' | 'this_or_that' | 'know_me' | 'draw_together';
type JsonObject = Record<string, any>;

type BingoSquare = {
  id: string;
  text: string;
  kind: 'claim' | 'partner';
  completed?: boolean;
  pending?: boolean;
  blockedUntil?: string | null;
};

const gameTypes = ['bingo', 'hangman', 'this_or_that', 'know_me', 'draw_together'] as const;
const gameTitles: Record<GameType, string> = {
  bingo: 'Relationship Bingo',
  hangman: 'Hangman',
  this_or_that: 'This or That',
  know_me: 'How Well Do You Know Me?',
  draw_together: 'Draw Together',
};

const bingoPool: Array<Omit<BingoSquare, 'id'>> = [
  { text: 'Get a kiss', kind: 'partner' }, { text: 'Get a hug', kind: 'partner' }, { text: 'Receive a compliment', kind: 'partner' },
  { text: 'Hear “I love you”', kind: 'partner' }, { text: 'Get called a pet name', kind: 'partner' }, { text: 'Receive a sweet message', kind: 'partner' },
  { text: 'Get a spontaneous selfie', kind: 'partner' }, { text: 'Receive a voice message', kind: 'partner' }, { text: 'Get a goodnight message', kind: 'partner' },
  { text: 'Partner chooses a song for you', kind: 'partner' }, { text: 'Get a little surprise', kind: 'partner' }, { text: 'Receive a heart', kind: 'partner' },
  { text: 'Make your partner laugh', kind: 'claim' }, { text: 'Make your partner blush', kind: 'claim' }, { text: 'Catch them staring at you', kind: 'claim' },
  { text: 'Say the same thing at once', kind: 'claim' }, { text: 'Share an inside joke', kind: 'claim' }, { text: 'Plan something together', kind: 'claim' },
  { text: 'Do something thoughtful', kind: 'claim' }, { text: 'Remember a tiny detail', kind: 'claim' }, { text: 'Make them smile unexpectedly', kind: 'claim' },
  { text: 'Start a cuddle', kind: 'claim' }, { text: 'Send something that reminds you of them', kind: 'claim' }, { text: 'Give an unprompted compliment', kind: 'claim' },
  { text: 'Ask about their day first', kind: 'claim' }, { text: 'Suggest a date idea', kind: 'claim' }, { text: 'Share a favourite memory', kind: 'claim' },
  { text: 'Make them choose the movie', kind: 'claim' }, { text: 'Get them to sing', kind: 'claim' }, { text: 'Make them use your favourite pet name', kind: 'claim' },
  { text: 'Send a ridiculous photo', kind: 'claim' }, { text: 'Start a spontaneous call', kind: 'claim' }, { text: 'Win a mini game', kind: 'claim' },
  { text: 'Answer today’s question', kind: 'claim' }, { text: 'Add a shared memory', kind: 'claim' }, { text: 'Make a future plan', kind: 'claim' },
];


const longDistanceBingoPool: Array<Omit<BingoSquare, 'id'>> = [
  { text: 'Receive a kiss emoji', kind: 'partner' }, { text: 'Get a spontaneous selfie', kind: 'partner' }, { text: 'Receive a voice message', kind: 'partner' },
  { text: 'Get a goodnight message', kind: 'partner' }, { text: 'Hear “I love you” on call', kind: 'partner' }, { text: 'Get called a pet name', kind: 'partner' },
  { text: 'Receive a sweet message', kind: 'partner' }, { text: 'Partner turns their camera on', kind: 'partner' }, { text: 'Get a song sent to you', kind: 'partner' },
  { text: 'Receive a heart', kind: 'partner' }, { text: 'Get a photo of their view', kind: 'partner' }, { text: 'Receive a surprise call', kind: 'partner' },
  { text: 'Make your partner laugh on call', kind: 'claim' }, { text: 'Make your partner blush', kind: 'claim' }, { text: 'Fall asleep on call together', kind: 'claim' },
  { text: 'Say the same thing at once', kind: 'claim' }, { text: 'Share an inside joke', kind: 'claim' }, { text: 'Plan the next visit', kind: 'claim' },
  { text: 'Do something thoughtful', kind: 'claim' }, { text: 'Remember a tiny detail', kind: 'claim' }, { text: 'Make them smile unexpectedly', kind: 'claim' },
  { text: 'Start a spontaneous video call', kind: 'claim' }, { text: 'Send something that reminds you of them', kind: 'claim' }, { text: 'Give an unprompted compliment', kind: 'claim' },
  { text: 'Ask about their day first', kind: 'claim' }, { text: 'Suggest a virtual date', kind: 'claim' }, { text: 'Share a favourite memory', kind: 'claim' },
  { text: 'Watch something together', kind: 'claim' }, { text: 'Get them to sing', kind: 'claim' }, { text: 'Make them use your favourite pet name', kind: 'claim' },
  { text: 'Send a ridiculous photo', kind: 'claim' }, { text: 'Play a game together', kind: 'claim' }, { text: 'Answer today’s question', kind: 'claim' },
  { text: 'Add a shared memory', kind: 'claim' }, { text: 'Make a future plan', kind: 'claim' }, { text: 'Talk for over an hour', kind: 'claim' },
];

const thisOrThatPool = [
  ['Date-night energy?', 'Dress up and go out', 'Blankets and takeaway'], ['Holiday?', 'Beach', 'Mountains'], ['Movie snack?', 'Sweet', 'Salty'],
  ['Weekend?', 'Big adventure', 'Absolutely nothing'], ['Affection?', 'Long hug', 'Forehead kiss'], ['Wake up?', 'Early together', 'Sleep in'],
  ['Trip style?', 'Plan everything', 'Figure it out there'], ['Night?', 'Movie marathon', 'Gaming together'], ['Food?', 'Cook together', 'Order our favourite'],
  ['Photos?', 'Cute posed photo', 'Chaotic candid'], ['Surprise?', 'Tiny thoughtful gift', 'Spontaneous date'], ['Weather?', 'Rainy day inside', 'Sunny day outside'],
  ['Messages?', 'Long love message', 'Random little check-ins'], ['Music?', 'Share headphones', 'Make each other playlists'], ['Travel?', 'Road trip', 'Fly somewhere new'],
  ['Home?', 'Cosy and quiet', 'Friends over'], ['Dessert?', 'Chocolate', 'Ice cream'], ['Competition?', 'Team up', 'Versus each other'],
  ['Memory?', 'Recreate an old date', 'Try something brand new'], ['Evening?', 'Watch sunset', 'Stay up talking'],
  ['Photo challenge?', 'Cute', 'Ridiculous'], ['Date budget?', 'Cheap creative date', 'Save for something fancy'], ['Morning?', 'Coffee run', 'Breakfast in bed'],
  ['Gift?', 'Something useful', 'Something sentimental'], ['Call?', 'Video call', 'Voice call'], ['Explore?', 'City', 'Nature'],
  ['Rain?', 'Go out in it', 'Stay warm inside'], ['Games?', 'Co-op', 'Competitive'], ['Plans?', 'Surprise me', 'Let’s decide together'], ['Keepsake?', 'Printed photos', 'Saved messages'],
] as const;

const knowMePool = [
  ['My ideal lazy evening is…', ['Movie in bed', 'Gaming', 'Long conversation', 'Scrolling beside you']],
  ['If I could leave tomorrow, I would choose…', ['Beach holiday', 'Cabin getaway', 'Big city', 'Road trip']],
  ['When I am stressed, I appreciate…', ['Affection', 'Space', 'Reassurance', 'Distraction']],
  ['The best surprise for me is…', ['Food', 'A little gift', 'A planned date', 'A heartfelt message']],
  ['On a free Saturday I would rather…', ['Stay home', 'Explore somewhere', 'See friends', 'Do a project together']],
  ['My strongest love-language moment is…', ['Touch', 'Words', 'Quality time', 'Acts of service']],
  ['For date night, I usually want…', ['Something romantic', 'Something silly', 'Something adventurous', 'Something cosy']],
  ['I would rather receive…', ['Flowers', 'Food', 'A handwritten note', 'A practical gift']],
  ['The trip I would enjoy most is…', ['Relaxing resort', 'Nature getaway', 'Theme park/adventure', 'Food and culture trip']],
  ['If we have one hour together, I pick…', ['Cuddle and talk', 'Play a game', 'Go for a walk', 'Watch something']],
  ['My comfort food mood is…', ['Sweet', 'Salty', 'Takeaway', 'Home cooked']],
  ['I am most likely to save…', ['Photos', 'Messages', 'Tickets/keepsakes', 'All of it']],
] as const;

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

async function coupleMembers(coupleId: string) {
  const result = await pool.query('SELECT user_id FROM couple_members WHERE couple_id=$1 ORDER BY joined_at, user_id', [coupleId]);
  return result.rows.map((row: JsonObject) => String(row.user_id));
}

function uuidValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, `${label} is invalid.`);
  return value;
}

function normalizeSecret(value: unknown) {
  const secret = requiredText(value, 'Secret word or phrase', 80).toUpperCase().replace(/[^A-Z '\-]/g, '').replace(/\s+/g, ' ').trim();
  if (secret.replace(/[^A-Z]/g, '').length < 2) throw new ApiError(400, 'Use at least two letters.');
  return secret;
}

function bingoLines() {
  const rows = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c));
  const cols = Array.from({ length: 5 }, (_, c) => Array.from({ length: 5 }, (_, r) => r * 5 + c));
  return [...rows, ...cols, [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
}

function bingoWon(card: BingoSquare[], condition: string) {
  const complete = (index: number) => Boolean(card[index]?.completed);
  if (condition === 'full') return card.every((square) => square.completed);
  if (condition === 'four_corners') return [0, 4, 20, 24].every(complete);
  const completedLines = bingoLines().filter((line) => line.every(complete)).length;
  return condition === 'two_lines' ? completedLines >= 2 : completedLines >= 1;
}

function gameRow(row: JsonObject, userId: string) {
  const state = row.state as JsonObject;
  const base = {
    id: String(row.id), couple_id: String(row.couple_id), creator_id: String(row.creator_id), game_type: row.game_type as GameType,
    status: String(row.status), title: String(row.title), reward: String(row.reward ?? ''), settings: row.settings ?? {}, winner_user_id: row.winner_user_id ? String(row.winner_user_id) : null,
    created_at: row.created_at, updated_at: row.updated_at,
  };

  if (row.game_type === 'hangman') {
    const secret = String(state.secretWord ?? '');
    const guesses = Array.isArray(state.guesses) ? state.guesses as string[] : [];
    const maskedWord = secret.split('').map((char) => /[A-Z0-9]/.test(char) && !guesses.includes(char) ? '_' : char).join('');
    return { ...base, state: { ...state, secretWord: userId === state.hostUserId || row.status !== 'active' ? secret : undefined, maskedWord } };
  }

  if (row.game_type === 'this_or_that') {
    const index = Number(state.index ?? 0);
    const answers = state.answers ?? {};
    const current = answers[String(index)] ?? {};
    const both = Object.keys(current).length >= 2;
    const safeAnswers: JsonObject = {};
    for (const [key, value] of Object.entries(answers)) {
      const roundIndex = Number(key);
      if (roundIndex < index || (roundIndex === index && both)) safeAnswers[key] = value;
      else if (roundIndex === index && current[userId] !== undefined) safeAnswers[key] = { [userId]: current[userId] };
    }
    return { ...base, state: { ...state, answers: safeAnswers, currentRevealed: both } };
  }

  if (row.game_type === 'know_me') {
    const index = Number(state.index ?? 0);
    const round = state.rounds?.[index];
    const current = state.answers?.[String(index)] ?? {};
    const subjectId = round?.subjectUserId;
    const guesserId = state.members?.find((id: string) => id !== subjectId);
    const both = current.subject !== undefined && current.guess !== undefined;
    const safeAnswers: JsonObject = {};
    for (const [key, value] of Object.entries(state.answers ?? {})) {
      const ri = Number(key);
      if (ri < index || (ri === index && both)) safeAnswers[key] = value;
      else if (ri === index) {
        const own: JsonObject = {};
        if (userId === subjectId && (value as JsonObject).subject !== undefined) own.subject = (value as JsonObject).subject;
        if (userId === guesserId && (value as JsonObject).guess !== undefined) own.guess = (value as JsonObject).guess;
        safeAnswers[key] = own;
      }
    }
    return { ...base, state: { ...state, answers: safeAnswers, currentRevealed: both, subjectLocked: current.subject !== undefined } };
  }

  return { ...base, state };
}

function makeBingoCard(longDistance = false) {
  const selected = shuffle(longDistance ? longDistanceBingoPool : bingoPool).slice(0, 24).map((square) => ({ ...square, id: randomUUID(), completed: false, pending: false }));
  selected.splice(12, 0, { id: randomUUID(), text: 'Togetherly ✦', kind: 'claim', completed: true, pending: false });
  return selected;
}


function drawingStroke(value: unknown, userId: string) {
  if (!value || typeof value !== 'object') throw new ApiError(400, 'Drawing stroke is invalid.');
  const raw = value as JsonObject;
  if (!Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > 500) throw new ApiError(400, 'Drawing stroke has too many points.');
  const points = raw.points.map((point: unknown) => {
    if (!point || typeof point !== 'object') throw new ApiError(400, 'Drawing point is invalid.');
    const x = Number((point as JsonObject).x);
    const y = Number((point as JsonObject).y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 1000) throw new ApiError(400, 'Drawing point is outside the canvas.');
    return { x, y };
  });
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color.toLowerCase() : undefined;
  const opacity = Math.max(0.1, Math.min(1, Number(raw.opacity) || 1));
  const tool = ['pen', 'marker', 'highlighter', 'eraser'].includes(String(raw.tool)) ? String(raw.tool) : undefined;
  return { id: typeof raw.id === 'string' ? raw.id.slice(0, 80) : randomUUID(), userId, points, width: Math.max(1, Math.min(48, Number(raw.width) || 7)), ...(color ? { color } : {}), opacity, ...(tool ? { tool } : {}) };
}

function createInitialState(gameType: GameType, members: string[], creatorId: string, body: JsonObject, longDistance: boolean) {
  const partnerId = members.find((id) => id !== creatorId);
  if (!partnerId) throw new ApiError(400, 'Link your partner before starting a shared game.');

  if (gameType === 'bingo') {
    const winCondition = oneOf(body.winCondition, ['line', 'two_lines', 'four_corners', 'full'] as const, 'line');
    return { members, winCondition, longDistance, cards: Object.fromEntries(members.map((id) => [id, makeBingoCard(longDistance)])) };
  }
  if (gameType === 'hangman') {
    return { members, hostUserId: creatorId, guesserUserId: partnerId, secretWord: normalizeSecret(body.secretWord), guesses: [], wrongGuesses: 0, maxWrong: 6 };
  }
  if (gameType === 'this_or_that') {
    const count = Math.max(5, Math.min(20, Number(body.roundCount) || 10));
    const rounds = shuffle(thisOrThatPool).slice(0, count).map(([question, left, right]) => ({ question, left, right }));
    return { members, rounds, index: 0, answers: {}, matches: 0 };
  }
  if (gameType === 'draw_together') return { members, strokes: [] };
  const count = Math.max(4, Math.min(12, Number(body.roundCount) || 6));
  const selected = shuffle(knowMePool).slice(0, count).map(([question, choices], index) => ({ question, choices: shuffle(choices), subjectUserId: members[index % members.length] }));
  return { members, rounds: selected, index: 0, answers: {}, scores: Object.fromEntries(members.map((id) => [id, 0])) };
}

async function loadGameForUpdate(client: any, id: string, coupleId: string) {
  const result = await client.query('SELECT * FROM game_sessions WHERE id=$1 AND couple_id=$2 FOR UPDATE', [id, coupleId]);
  if (!result.rows[0]) throw new ApiError(404, 'Game not found.');
  return result.rows[0] as JsonObject;
}

function ensureActive(row: JsonObject) {
  if (row.status !== 'active') throw new ApiError(409, 'This game has already finished.');
}

export async function registerGameRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/games', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query('SELECT * FROM game_sessions WHERE couple_id=$1 ORDER BY (status=\'active\') DESC, updated_at DESC LIMIT 50', [coupleId]);
      return reply.send({ games: result.rows.map((row: JsonObject) => gameRow(row, request.userId)) });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/games/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Game');
      const result = await pool.query('SELECT * FROM game_sessions WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!result.rows[0]) throw new ApiError(404, 'Game not found.');
      return reply.send({ game: gameRow(result.rows[0], request.userId) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/games', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const members = await coupleMembers(coupleId);
      if (members.length < 2) throw new ApiError(400, 'Link your partner before starting a shared game.');
      const body = request.body as JsonObject;
      const gameType = oneOf(body.gameType, gameTypes, 'this_or_that');
      const title = optionalText(body.title, 120) || gameTitles[gameType];
      const reward = optionalText(body.reward, 300);
      const coupleResult = await pool.query('SELECT long_distance_enabled FROM couples WHERE id=$1', [coupleId]);
      const state = createInitialState(gameType, members, request.userId, body, Boolean(coupleResult.rows[0]?.long_distance_enabled));
      const id = randomUUID();
      const result = await pool.query(
        'INSERT INTO game_sessions(id,couple_id,creator_id,game_type,title,reward,settings,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [id, coupleId, request.userId, gameType, title, reward, JSON.stringify({}), JSON.stringify(state)],
      );
      broadcast(realtime, coupleId, 'games', 'created', id);
      return reply.code(201).send({ game: gameRow(result.rows[0], request.userId) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/games/:id/actions', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Game');
      const body = request.body as JsonObject;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
      const row = await loadGameForUpdate(client, id, coupleId);
      ensureActive(row);
      const state = row.state as JsonObject;
      const members = state.members as string[];
      if (!Array.isArray(members) || !members.includes(request.userId)) throw new ApiError(403, 'You are not part of this game.');
      const partnerId = members.find((memberId) => memberId !== request.userId);
      const action = requiredText(body.action, 'Action', 60);
      let winnerUserId: string | null = row.winner_user_id ? String(row.winner_user_id) : null;
      let status = String(row.status);

      if (row.game_type === 'bingo') {
        const cards = state.cards as Record<string, BingoSquare[]>;
        const ownerId = typeof body.ownerUserId === 'string' ? body.ownerUserId : request.userId;
        if (!members.includes(ownerId)) throw new ApiError(400, 'That player is not in this game.');
        const card = cards[ownerId];
        if (!card) throw new ApiError(404, 'Bingo card not found.');
        const square = card.find((item) => item.id === body.squareId);
        if (!square) throw new ApiError(404, 'Bingo square not found.');
        if (square.completed) throw new ApiError(409, 'That square is already complete.');

        if (action === 'claim') {
          if (ownerId !== request.userId || square.kind !== 'claim') throw new ApiError(403, 'You cannot claim that square.');
          square.pending = true;
        } else if (action === 'confirm' || action === 'reject') {
          if (ownerId === request.userId || !square.pending) throw new ApiError(403, 'There is no partner claim to review.');
          square.pending = false;
          if (action === 'confirm') square.completed = true;
        } else if (action === 'give') {
          if (ownerId === request.userId || square.kind !== 'partner') throw new ApiError(403, 'Only your partner can give that square.');
          square.completed = true;
        } else throw new ApiError(400, 'Unknown Bingo action.');

        if (square.completed && bingoWon(card, String(state.winCondition ?? 'line'))) {
          winnerUserId = ownerId;
          status = 'completed';
        }
      } else if (row.game_type === 'hangman') {
        if (request.userId !== state.guesserUserId) throw new ApiError(403, 'Only the guessing partner can make guesses.');
        const secret = String(state.secretWord);
        const guesses = state.guesses as string[];
        if (action === 'guess_letter') {
          const letter = String(body.letter ?? '').toUpperCase();
          if (!/^[A-Z0-9]$/.test(letter)) throw new ApiError(400, 'Choose one letter or number.');
          if (guesses.includes(letter)) throw new ApiError(409, 'You already guessed that.');
          guesses.push(letter);
          if (!secret.includes(letter)) state.wrongGuesses = Number(state.wrongGuesses ?? 0) + 1;
        } else if (action === 'guess_word') {
          const guess = normalizeSecret(body.guess);
          const unique = [...new Set(guess.replace(/[^A-Z0-9]/g, '').split(''))];
          if (guess === secret) unique.forEach((letter) => { if (!guesses.includes(letter)) guesses.push(letter); });
          else state.wrongGuesses = Number(state.wrongGuesses ?? 0) + 1;
        } else throw new ApiError(400, 'Unknown Hangman action.');

        const solved = secret.replace(/[^A-Z0-9]/g, '').split('').every((letter) => guesses.includes(letter));
        if (solved) { status = 'completed'; winnerUserId = request.userId; }
        else if (Number(state.wrongGuesses) >= Number(state.maxWrong ?? 6)) { status = 'completed'; winnerUserId = String(state.hostUserId); }
      } else if (row.game_type === 'this_or_that') {
        const index = Number(state.index ?? 0);
        const currentKey = String(index);
        const answers = state.answers as Record<string, Record<string, string>>;
        answers[currentKey] ??= {};
        const current = answers[currentKey]!;
        if (action === 'answer') {
          const choice = oneOf(body.choice, ['left', 'right'] as const, 'left');
          if (current[request.userId] !== undefined) throw new ApiError(409, 'You already answered this round.');
          current[request.userId] = choice;
          if (partnerId && current[partnerId] !== undefined && current[partnerId] === choice) state.matches = Number(state.matches ?? 0) + 1;
        } else if (action === 'next') {
          if (Object.keys(current).length < members.length) throw new ApiError(409, 'Wait until you have both answered.');
          if (index >= state.rounds.length - 1) status = 'completed';
          else state.index = index + 1;
        } else throw new ApiError(400, 'Unknown This or That action.');
      } else if (row.game_type === 'know_me') {
        const index = Number(state.index ?? 0);
        const round = state.rounds[index];
        const currentKey = String(index);
        state.answers[currentKey] ??= {};
        const current = state.answers[currentKey] as JsonObject;
        const subjectUserId = String(round.subjectUserId);
        const guesserUserId = members.find((memberId) => memberId !== subjectUserId)!;
        if (action === 'answer') {
          const choiceIndex = Number(body.choiceIndex);
          if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= round.choices.length) throw new ApiError(400, 'Choose one of the answers.');
          if (request.userId === subjectUserId) {
            if (current.subject !== undefined) throw new ApiError(409, 'Your answer is already locked in.');
            current.subject = choiceIndex;
          } else if (request.userId === guesserUserId) {
            if (current.subject === undefined) throw new ApiError(409, 'Wait for your partner to lock in their answer first.');
            if (current.guess !== undefined) throw new ApiError(409, 'Your guess is already locked in.');
            current.guess = choiceIndex;
            if (current.guess === current.subject) state.scores[guesserUserId] = Number(state.scores[guesserUserId] ?? 0) + 1;
          }
        } else if (action === 'next') {
          if (current.subject === undefined || current.guess === undefined) throw new ApiError(409, 'Finish this round first.');
          if (index >= state.rounds.length - 1) {
            status = 'completed';
            const scores = state.scores as Record<string, number>;
            const [first, second] = members;
            winnerUserId = Number(scores[first!] ?? 0) === Number(scores[second!] ?? 0) ? null : Number(scores[first!] ?? 0) > Number(scores[second!] ?? 0) ? first! : second!;
          } else state.index = index + 1;
        } else throw new ApiError(400, 'Unknown Know Me action.');
      } else if (row.game_type === 'draw_together') {
        const strokes = Array.isArray(state.strokes) ? state.strokes as JsonObject[] : [];
        state.strokes = strokes;
        if (action === 'draw_stroke') {
          if (strokes.length >= 500) throw new ApiError(409, 'This canvas has reached its stroke limit. Clear it to keep drawing.');
          strokes.push(drawingStroke(body.stroke, request.userId));
        } else if (action === 'undo_stroke') {
          const index = strokes.map((stroke) => String(stroke.userId ?? '')).lastIndexOf(request.userId);
          if (index >= 0) strokes.splice(index, 1);
        } else if (action === 'clear_drawing') {
          state.strokes = [];
        } else throw new ApiError(400, 'Unknown drawing action.');
      }

      const result = await client.query('UPDATE game_sessions SET state=$1,status=$2,winner_user_id=$3,updated_at=now() WHERE id=$4 RETURNING *', [JSON.stringify(state), status, winnerUserId, id]);
      await client.query('COMMIT');
      broadcast(realtime, coupleId, 'games', action, id);
        return reply.send({ game: gameRow(result.rows[0], request.userId) });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { client.release(); }
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/games/:id/abandon', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Game');
      const result = await pool.query("UPDATE game_sessions SET status='abandoned',updated_at=now() WHERE id=$1 AND couple_id=$2 AND status='active' RETURNING *", [id, coupleId]);
      if (!result.rows[0]) throw new ApiError(404, 'Active game not found.');
      broadcast(realtime, coupleId, 'games', 'abandoned', id);
      return reply.send({ game: gameRow(result.rows[0], request.userId) });
    } catch (error) { return sendError(reply, error); }
  });
}
