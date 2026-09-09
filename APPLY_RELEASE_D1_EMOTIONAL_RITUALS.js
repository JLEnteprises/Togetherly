const fs = require('fs');
const path = require('path');

const root = process.cwd();
function p(rel) { return path.join(root, rel); }
function read(rel) {
  const file = p(rel);
  if (!fs.existsSync(file)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function replaceOnce(rel, oldText, newText, label) {
  let text = read(rel);
  if (text.includes(newText)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(oldText);
  if (i < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, i + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function insertBefore(rel, marker, addition, alreadyMarker, label) {
  let text = read(rel);
  if (alreadyMarker && text.includes(alreadyMarker)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(marker);
  if (i < 0) throw new Error(`Could not find insertion point in ${rel}: ${label}`);
  text = text.slice(0, i) + addition + text.slice(i);
  write(rel, text);
}
function replaceRange(rel, startMarker, endMarker, replacement, alreadyMarker, label) {
  let text = read(rel);
  if (alreadyMarker && text.includes(alreadyMarker)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker in ${rel}: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker in ${rel}: ${label}`);
  text = text.slice(0, start) + replacement + text.slice(end);
  write(rel, text);
}

// C3 checkpoint verification.
for (const [rel, marker] of [
  ['server/migrations/015_activity_shared_day.sql', 'shared_day_timezone'],
  ['server/src/utils/sharedDay.ts', 'dateKeyInTimeZone'],
  ['src/app/features/activity-randomizer.tsx', 'pick.is_favourite'],
  ['server/src/routes/together.ts', "a.status IN ('want_to_do','planned','do_again')"],
]) {
  if (!read(rel).includes(marker)) throw new Error(`${rel} is not the expected Release C baseline. Missing: ${marker}`);
}

write('server/migrations/016_emotional_rituals.sql', "-- Togetherly Release D1: persistent emotional acknowledgements and daily-question reveal state.\n\nCREATE TABLE IF NOT EXISTS mood_acknowledgements (\n  mood_id uuid NOT NULL REFERENCES moods(id) ON DELETE CASCADE,\n  acknowledger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  acknowledged_at timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (mood_id, acknowledger_user_id)\n);\nCREATE INDEX IF NOT EXISTS mood_acknowledgements_user_idx\n  ON mood_acknowledgements(acknowledger_user_id, acknowledged_at DESC);\n\nCREATE TABLE IF NOT EXISTS daily_question_reveals (\n  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,\n  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,\n  answer_date date NOT NULL,\n  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  revealed_at timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (couple_id, question_id, answer_date, user_id)\n);\nCREATE INDEX IF NOT EXISTS daily_question_reveals_user_idx\n  ON daily_question_reveals(user_id, answer_date DESC);\n");

// ------------------------------------------------------------
// TYPES + API
// ------------------------------------------------------------
replaceOnce(
  'src/types/database.ts',
  `  bothAnswered: boolean;
  waitingForPartner?: boolean;`,
  `  bothAnswered: boolean;
  revealed?: boolean;
  revealedAt?: string | null;
  waitingForPartner?: boolean;`,
  'daily-question reveal state'
);

replaceOnce(
  'src/types/database.ts',
  `export type MoodEntry = { id: string; user_id: string; couple_id: string; mood: MoodValue; need: NeedValue; visibility: 'shared' | 'private'; created_at: string };`,
  `export type MoodEntry = { id: string; user_id: string; couple_id: string; mood: MoodValue; need: NeedValue; visibility: 'shared' | 'private'; acknowledged_by_me?: boolean; acknowledged_at?: string | null; created_at: string };`,
  'mood acknowledgement state'
);

insertBefore(
  'src/services/backend/mvpFeatures.ts',
  `export async function getDailyQuestionHistory`,
  `export async function revealDailyQuestion(questionId: string) { return apiRequest<{ revealed: true; revealedAt: string }>('/daily-question/reveal', { method: 'POST', body: { questionId } }); }
`,
  `revealDailyQuestion(questionId`,
  'daily-question reveal API'
);

// ------------------------------------------------------------
// SERVER DAILY QUESTION
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/together.ts',
  `if (!question) return reply.send({ question: null, date: today, dayTimeZone, myAnswer: null, partnerAnswer: null, bothAnswered: false, disabledCategories });`,
  `if (!question) return reply.send({ question: null, date: today, dayTimeZone, myAnswer: null, partnerAnswer: null, bothAnswered: false, revealed: false, revealedAt: null, disabledCategories });`,
  'empty daily-question reveal state'
);

replaceOnce(
  'server/src/routes/together.ts',
  `      const bothAnswered = Number(memberCount.rows[0]?.count ?? 0) >= 2 && Boolean(mine && partner);
      return reply.send({ question, date: today, dayTimeZone, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered, waitingForPartner: Boolean(mine && !bothAnswered), disabledCategories });`,
  `      const bothAnswered = Number(memberCount.rows[0]?.count ?? 0) >= 2 && Boolean(mine && partner);
      const reveal = bothAnswered ? await pool.query(
        'SELECT revealed_at FROM daily_question_reveals WHERE couple_id=$1 AND question_id=$2 AND answer_date=$3 AND user_id=$4 LIMIT 1',
        [coupleId, question.id, today, request.userId],
      ) : { rows: [] as Record<string, unknown>[] };
      return reply.send({
        question,
        date: today,
        dayTimeZone,
        myAnswer: mine,
        partnerAnswer: bothAnswered ? partner : null,
        bothAnswered,
        revealed: Boolean(reveal.rows[0]),
        revealedAt: reveal.rows[0]?.revealed_at ?? null,
        waitingForPartner: Boolean(mine && !bothAnswered),
        disabledCategories,
      });`,
  'daily-question reveal state'
);

insertBefore(
  'server/src/routes/together.ts',
  `  app.get('/moods/latest'`,
  `  app.post('/daily-question/reveal', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const questionId = requiredText(body.questionId, 'Question', 100);
      const { question, today } = await loadTodaysQuestion(coupleId);
      if (!question || String(question.id) !== questionId) throw new ApiError(409, 'The daily question has changed. Refresh and try again.');

      const memberCount = await pool.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id=$1', [coupleId]);
      const answers = await pool.query(
        'SELECT count(DISTINCT user_id)::int AS count FROM question_answers WHERE couple_id=$1 AND question_id=$2 AND answer_date=$3',
        [coupleId, questionId, today],
      );
      if (Number(memberCount.rows[0]?.count ?? 0) < 2 || Number(answers.rows[0]?.count ?? 0) < 2) {
        throw new ApiError(409, 'Both of you need to answer before the reveal.');
      }

      const result = await pool.query(
        `INSERT INTO daily_question_reveals(couple_id,question_id,answer_date,user_id)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(couple_id,question_id,answer_date,user_id)
         DO UPDATE SET revealed_at=daily_question_reveals.revealed_at
         RETURNING revealed_at`,
        [coupleId, questionId, today, request.userId],
      );
      broadcast(realtime, coupleId, 'questions', 'revealed', questionId);
      return reply.send({ revealed: true, revealedAt: result.rows[0].revealed_at });
    } catch (error) { return sendError(reply, error); }
  });

`,
  `app.post('/daily-question/reveal'`,
  'daily-question reveal endpoint'
);

// ------------------------------------------------------------
// SERVER MOOD ACKNOWLEDGEMENT
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/together.ts',
  `  app.get('/moods/latest'`,
  `  app.post('/moods/:id/acknowledge'`,
  `  app.get('/moods/latest', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const mine = await pool.query(
        'SELECT * FROM moods WHERE couple_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1',
        [coupleId, request.userId],
      );
      const partner = await pool.query(
        `SELECT m.*,
          EXISTS(
            SELECT 1 FROM mood_acknowledgements ma
            WHERE ma.mood_id=m.id AND ma.acknowledger_user_id=$2
          ) AS acknowledged_by_me,
          (
            SELECT ma.acknowledged_at FROM mood_acknowledgements ma
            WHERE ma.mood_id=m.id AND ma.acknowledger_user_id=$2
            LIMIT 1
          ) AS acknowledged_at
         FROM moods m
         WHERE m.couple_id=$1 AND m.user_id<>$2 AND m.visibility='shared'
         ORDER BY m.created_at DESC LIMIT 1`,
        [coupleId, request.userId],
      );
      return reply.send({ mine: mine.rows[0] ?? null, partner: partner.rows[0] ?? null });
    } catch (error) { return sendError(reply, error); }
  });

`,
  `acknowledged_by_me`,
  'latest mood acknowledgement state'
);

replaceRange(
  'server/src/routes/together.ts',
  `  app.post('/moods/:id/acknowledge'`,
  `  app.post('/moods',`,
  `  app.post('/moods/:id/acknowledge', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const mood = await pool.query(
        `SELECT id,user_id FROM moods WHERE id=$1 AND couple_id=$2 AND user_id<>$3 AND visibility='shared' LIMIT 1`,
        [params.id, coupleId, request.userId],
      );
      if (!mood.rows[0]) throw new ApiError(404, 'That shared check-in is no longer available.');

      const inserted = await pool.query(
        `INSERT INTO mood_acknowledgements(mood_id,acknowledger_user_id)
         VALUES($1,$2)
         ON CONFLICT(mood_id,acknowledger_user_id) DO NOTHING
         RETURNING acknowledged_at`,
        [params.id, request.userId],
      );
      if (inserted.rowCount) {
        await notifyPartner({
          coupleId,
          actorUserId: request.userId,
          kind: 'mood',
          preference: 'notification_partner_mood',
          entityType: 'mood',
          entityId: params.id,
          title: 'I’m here for you',
          body: 'Your partner saw your check-in and sent some support.',
        });
        broadcast(realtime, coupleId, 'moods', 'acknowledged', params.id);
      }
      return reply.send({ ok: true, acknowledgedAt: inserted.rows[0]?.acknowledged_at ?? null });
    } catch (error) { return sendError(reply, error); }
  });

`,
  `INSERT INTO mood_acknowledgements`,
  'persistent mood acknowledgement'
);

// ------------------------------------------------------------
// WATCH ACKNOWLEDGEMENT — same persistence/dedupe as phone.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/watch.ts',
  `  app.post('/watch/acknowledge'`,
  `  });
}`,
  `  app.post('/watch/acknowledge', { preHandler: watchPreHandler }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const moodId = typeof body.moodId === 'string' ? body.moodId : '';
      if (!/^[0-9a-f-]{36}$/i.test(moodId)) throw new ApiError(400, 'Mood is invalid.');
      const mood = await pool.query(
        `SELECT id,user_id FROM moods WHERE id=$1 AND couple_id=$2 AND visibility='shared'`,
        [moodId, coupleId],
      );
      if (!mood.rows[0] || String(mood.rows[0].user_id) === request.userId) throw new ApiError(404, 'Partner check-in not found.');

      const inserted = await pool.query(
        `INSERT INTO mood_acknowledgements(mood_id,acknowledger_user_id)
         VALUES($1,$2)
         ON CONFLICT(mood_id,acknowledger_user_id) DO NOTHING
         RETURNING acknowledged_at`,
        [moodId, request.userId],
      );
      if (inserted.rowCount) {
        await notifyPartner({
          coupleId,
          actorUserId: request.userId,
          kind: 'mood',
          preference: 'notification_partner_mood',
          entityType: 'mood',
          entityId: moodId,
          title: 'I’m here for you',
          body: 'Your partner saw your check-in and sent some support.',
        });
        broadcast(realtime, coupleId, 'moods', 'acknowledged', moodId);
      }
      return reply.send({ ok: true, state: await loadWatchState(request.userId) });
    } catch (error) { return sendError(reply, error); }
`,
  `mood_acknowledgements(mood_id,acknowledger_user_id)`,
  'watch persistent acknowledgement'
);

// ------------------------------------------------------------
// DAILY QUESTION CLIENT — persist reveal per person.
// ------------------------------------------------------------
replaceOnce(
  'src/app/features/daily-question.tsx',
  `import { answerDailyQuestion, getDailyQuestion, getDailyQuestionHistory, updateDailyQuestionSettings } from '@/services/backend/mvpFeatures';`,
  `import { answerDailyQuestion, getDailyQuestion, getDailyQuestionHistory, revealDailyQuestion, updateDailyQuestionSettings } from '@/services/backend/mvpFeatures';`,
  'daily reveal import'
);

replaceOnce(
  'src/app/features/daily-question.tsx',
  `  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);`,
  `  const [busy, setBusy] = useState(false);
  const [revealBusy, setRevealBusy] = useState(false);
  const [loading, setLoading] = useState(true);`,
  'daily reveal busy state'
);

replaceOnce(
  'src/app/features/daily-question.tsx',
  `  useEffect(() => { setRevealed(false); }, [state?.date, state?.question?.id]);`,
  `  useEffect(() => { setRevealed(Boolean(state?.revealed)); }, [state?.date, state?.question?.id, state?.revealed]);`,
  'restore persisted reveal state'
);

insertBefore(
  'src/app/features/daily-question.tsx',
  `  async function toggleCategory`,
  `  async function revealAnswers() {
    if (!state?.question || !state.bothAnswered) return;
    setRevealBusy(true);
    try {
      const result = await revealDailyQuestion(state.question.id);
      setRevealed(true);
      setState((current) => current ? { ...current, revealed: true, revealedAt: result.revealedAt } : current);
    } catch (error) {
      Alert.alert('Couldn’t reveal answers', messageFrom(error));
    } finally {
      setRevealBusy(false);
    }
  }
`,
  `async function revealAnswers()`,
  'daily reveal handler'
);

replaceOnce(
  'src/app/features/daily-question.tsx',
  `<AppButton label="Reveal our answers" onPress={() => setRevealed(true)} />`,
  `<AppButton label={revealBusy ? 'Revealing…' : 'Reveal our answers'} disabled={revealBusy} onPress={revealAnswers} />`,
  'persistent reveal button'
);

// ------------------------------------------------------------
// MOOD CLIENT — server state replaces component-local acknowledgement.
// ------------------------------------------------------------
replaceOnce(
  'src/app/features/mood.tsx',
  `  const [ackBusy, setAckBusy] = useState(false);
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);`,
  `  const [ackBusy, setAckBusy] = useState(false);`,
  'remove local mood acknowledgement'
);

replaceRange(
  'src/app/features/mood.tsx',
  `  async function acknowledge() {`,
  `  return (`,
  `  async function acknowledge() {
    if (!partner || partner.acknowledged_by_me) return;
    setAckBusy(true);
    try {
      await acknowledgeMood(partner.id);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t send support', messageFrom(error));
    } finally {
      setAckBusy(false);
    }
  }

  const acknowledged = Boolean(partner?.acknowledged_by_me);

`,
  `const acknowledged = Boolean(partner?.acknowledged_by_me);`,
  'server-backed mood acknowledgement'
);

replaceOnce(
  'src/app/features/mood.tsx',
  `<AppButton compact variant={acknowledgedId === partner.id ? 'secondary' : 'primary'} label={acknowledgedId === partner.id ? 'Support sent' : ackBusy ? 'Sending…' : 'I’m here for you'} disabled={ackBusy || acknowledgedId === partner.id} onPress={acknowledge} />`,
  `<AppButton compact variant={acknowledged ? 'secondary' : 'primary'} label={acknowledged ? 'Support sent' : ackBusy ? 'Sending…' : 'I’m here for you'} disabled={ackBusy || acknowledged} onPress={acknowledge} />`,
  'mood acknowledgement button'
);

// ------------------------------------------------------------
// HOME: acknowledged support no longer hijacks Today priority;
// revealed Daily Question no longer keeps asking to reveal.
// ------------------------------------------------------------
replaceOnce(
  'src/components/dashboard/HomeTodayCard.tsx',
  `  const questionSummary = question?.bothAnswered ? 'Both answered · ready to reveal' : question?.myAnswer ? \`Waiting for \${partnerProfile?.display_name ?? 'your partner'}\` : question?.question ? 'A question is waiting for you' : 'No question today';`,
  `  const questionSummary = question?.bothAnswered ? (question.revealed ? 'Both answered · revealed' : 'Both answered · ready to reveal') : question?.myAnswer ? \`Waiting for \${partnerProfile?.display_name ?? 'your partner'}\` : question?.question ? 'A question is waiting for you' : 'No question today';`,
  'home daily reveal summary'
);

replaceOnce(
  'src/components/dashboard/HomeTodayCard.tsx',
  `  const partnerNeedsAttention = isRecent(partnerMood) && partnerMood?.need !== 'nothing';
  const revealReady = Boolean(question?.question && question.bothAnswered);`,
  `  const partnerNeedsAttention = isRecent(partnerMood) && partnerMood?.need !== 'nothing' && !partnerMood?.acknowledged_by_me;
  const revealReady = Boolean(question?.question && question.bothAnswered && !question.revealed);`,
  'home emotional priority completion'
);

// ------------------------------------------------------------
// FINAL AUDIT
// ------------------------------------------------------------
const checks = [
  ['server/migrations/016_emotional_rituals.sql', 'mood_acknowledgements'],
  ['server/migrations/016_emotional_rituals.sql', 'daily_question_reveals'],
  ['server/src/routes/together.ts', "app.post('/daily-question/reveal'"],
  ['server/src/routes/together.ts', 'acknowledged_by_me'],
  ['server/src/routes/together.ts', "broadcast(realtime, coupleId, 'moods', 'acknowledged'"],
  ['server/src/routes/watch.ts', 'mood_acknowledgements(mood_id,acknowledger_user_id)'],
  ['src/types/database.ts', 'revealed?: boolean'],
  ['src/types/database.ts', 'acknowledged_by_me?: boolean'],
  ['src/services/backend/mvpFeatures.ts', 'revealDailyQuestion(questionId'],
  ['src/app/features/daily-question.tsx', 'async function revealAnswers()'],
  ['src/app/features/mood.tsx', 'const acknowledged = Boolean(partner?.acknowledged_by_me)'],
  ['src/components/dashboard/HomeTodayCard.tsx', '!partnerMood?.acknowledged_by_me'],
  ['src/components/dashboard/HomeTodayCard.tsx', 'question.bothAnswered && !question.revealed'],
];

const missing = checks
  .filter(([rel, marker]) => !read(rel).includes(marker))
  .map(([rel, marker]) => `${rel}: missing ${marker}`);

if (missing.length) {
  fs.writeFileSync(p('RELEASE_D1_EMOTIONAL_RITUALS_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`D1 audit found ${missing.length} issue(s). See RELEASE_D1_EMOTIONAL_RITUALS_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_D1_EMOTIONAL_RITUALS_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('D1 emotional rituals audit clean.');
}

console.log('');
console.log('Release D1 applied.');
console.log('IMPORTANT: migration 016 is required.');
console.log('Run:');
console.log('  npm.cmd run backend:migrate');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
