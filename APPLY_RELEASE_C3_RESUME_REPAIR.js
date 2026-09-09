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
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
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
function replaceRange(rel, startMarker, endMarker, replacement, label) {
  let text = read(rel);
  if (text.includes(replacement)) {
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

// Verify the exact partial C3 state left by the failed installer.
for (const [rel, marker] of [
  ['server/migrations/015_activity_shared_day.sql', 'is_favourite boolean'],
  ['server/src/utils/sharedDay.ts', 'dateKeyInTimeZone'],
  ['src/types/database.ts', 'is_favourite: boolean'],
  ['src/types/database.ts', 'shared_day_timezone: string'],
  ['src/services/backend/mvpFeatures.ts', 'setActivityFavourite'],
  ['src/app/features/activities.tsx', `filter === 'favourite' ? activity.is_favourite`],
]) {
  if (!read(rel).includes(marker)) {
    throw new Error(`${rel} is not in the expected partial C3 state. Missing marker: ${marker}`);
  }
}

// ------------------------------------------------------------
// ACTIVITIES SCREEN — resume after the failed helper insertion.
// ------------------------------------------------------------
insertBefore(
  'src/app/features/activities.tsx',
  `  async function setStatus(activity: CoupleActivity, status: ActivityStatus)`,
  `  async function toggleFavourite(activity: CoupleActivity) {
    try {
      await setActivityFavourite(activity.id, !activity.is_favourite);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t update favourite', messageFrom(error));
    }
  }
`,
  `async function toggleFavourite(activity: CoupleActivity)`,
  'activity favourite helper'
);

replaceOnce(
  'src/app/features/activities.tsx',
  `{ text: activity.status === 'favourite' ? 'Remove favourite' : 'Favourite', onPress: () => setStatus(activity, activity.status === 'favourite' ? 'want_to_do' : 'favourite') },`,
  `{ text: activity.is_favourite ? 'Remove favourite' : 'Favourite', onPress: () => toggleFavourite(activity) },`,
  'activity menu favourite'
);

replaceOnce(
  'src/app/features/activities.tsx',
  `{ text: activity.status === 'completed' ? 'Move back to ideas' : 'Mark as done', onPress: () => setStatus(activity, activity.status === 'completed' ? 'want_to_do' : 'completed') },`,
  `{ text: activity.status === 'completed' ? 'Do this again' : activity.status === 'do_again' ? 'Move back to ideas' : 'Mark as done', onPress: () => setStatus(activity, activity.status === 'completed' ? 'do_again' : activity.status === 'do_again' ? 'want_to_do' : 'completed') },`,
  'activity lifecycle action'
);

insertBefore(
  'src/app/features/activities.tsx',
  `{activity.rating ? <TagChip subtle label={\`${activity.rating}/5 ★\`} /> : null}`,
  `{activity.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}`,
  `activity.is_favourite ? <TagChip subtle label="★ FAVOURITE"`,
  'activity favourite card chip'
);

insertBefore(
  'src/app/features/activities.tsx',
  `{(viewTarget.tags ?? []).map((tag) =>`,
  `{viewTarget.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}
          <TagChip subtle label={viewTarget.status.replace('_', ' ').toUpperCase()} />
          `,
  `viewTarget.is_favourite ? <TagChip subtle label="★ FAVOURITE"`,
  'activity detail favourite/lifecycle'
);

// ------------------------------------------------------------
// RANDOMIZER
// ------------------------------------------------------------
replaceOnce(
  'src/app/features/activity-randomizer.tsx',
  `import { getTags, randomActivity, rejectActivity, updateActivity } from '@/services/backend/mvpFeatures';`,
  `import { getTags, randomActivity, rejectActivity, setActivityFavourite } from '@/services/backend/mvpFeatures';`,
  'randomizer favourite import'
);

replaceRange(
  'src/app/features/activity-randomizer.tsx',
  `  async function choose(status: 'favourite') {`,
  `  return (`,
  `  async function toggleFavourite() {
    if (!pick) return;
    try {
      const updated = await setActivityFavourite(pick.id, !pick.is_favourite);
      setPick({ ...pick, ...updated });
    } catch (error) {
      Alert.alert('Couldn’t update favourite', messageFrom(error));
    }
  }

`,
  'randomizer favourite helper'
);

replaceOnce(
  'src/app/features/activity-randomizer.tsx',
  `<AppButton label={pick.status === 'favourite' ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={() => choose('favourite')} />`,
  `<AppButton label={pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={toggleFavourite} />`,
  'randomizer favourite button'
);

// ------------------------------------------------------------
// TOGETHER SERVER
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/together.ts',
  `const activityStatuses = ['want_to_do', 'planned', 'completed', 'favourite', 'do_again', 'skip'] as const;`,
  `const activityStatuses = ['want_to_do', 'planned', 'completed', 'do_again', 'skip'] as const;`,
  'server activity lifecycle statuses'
);

insertBefore(
  'server/src/routes/together.ts',
  `  app.post('/activities/:id/reject'`,
  `  app.post('/activities/:id/favourite', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const favourite = body.favourite === true;
      const result = await pool.query(
        'UPDATE activities SET is_favourite=$1,updated_at=now() WHERE id=$2 AND couple_id=$3 RETURNING *',
        [favourite, id, coupleId],
      );
      if (!result.rowCount) throw new ApiError(404, 'Activity not found.');
      broadcast(realtime, coupleId, 'activities', 'favourite', id);
      return reply.send({ activity: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

`,
  `app.post('/activities/:id/favourite'`,
  'server favourite endpoint'
);

replaceOnce(
  'server/src/routes/together.ts',
  `${activitySelect()} WHERE a.couple_id=$1 AND a.status <> 'skip'`,
  `${activitySelect()} WHERE a.couple_id=$1 AND a.status IN ('want_to_do','planned','do_again')`,
  'randomizer lifecycle filter'
);

ensureImport(
  'server/src/routes/together.ts',
  `import { dateKeyInTimeZone } from '../utils/sharedDay.js';`,
  `import { ApiError, sendError } from '../utils/http.js';`
);

replaceRange(
  'server/src/routes/together.ts',
  `async function loadTodaysQuestion(coupleId: string) {`,
  `function activitySelect() {`,
  `async function loadTodaysQuestion(coupleId: string) {
  const coupleResult = await pool.query('SELECT disabled_question_categories,shared_day_timezone FROM couples WHERE id=$1', [coupleId]);
  const disabledCategories = Array.isArray(coupleResult.rows[0]?.disabled_question_categories)
    ? coupleResult.rows[0].disabled_question_categories as string[]
    : [];
  const dayTimeZone = String(coupleResult.rows[0]?.shared_day_timezone || 'UTC');
  const questions = await pool.query(
    'SELECT id,question,category FROM questions WHERE enabled=true AND NOT(category = ANY($1::text[])) ORDER BY id',
    [disabledCategories],
  );
  const today = dateKeyInTimeZone(dayTimeZone);
  if (!questions.rowCount) return { question: null, today, dayTimeZone, disabledCategories };
  const dayNumber = Math.floor(Date.parse(\`\${today}T00:00:00Z\`) / 86_400_000);
  return { question: questions.rows[dayNumber % questions.rows.length], today, dayTimeZone, disabledCategories };
}

`,
  'shared daily-question day'
);

replaceOnce(
  'server/src/routes/together.ts',
  `const { question, today, disabledCategories } = await loadTodaysQuestion(coupleId);
      if (!question) return reply.send({ question: null, date: today, myAnswer: null, partnerAnswer: null, bothAnswered: false, disabledCategories });`,
  `const { question, today, dayTimeZone, disabledCategories } = await loadTodaysQuestion(coupleId);
      if (!question) return reply.send({ question: null, date: today, dayTimeZone, myAnswer: null, partnerAnswer: null, bothAnswered: false, disabledCategories });`,
  'daily-question empty response'
);

replaceOnce(
  'server/src/routes/together.ts',
  `return reply.send({ question, date: today, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered, waitingForPartner: Boolean(mine && !bothAnswered), disabledCategories });`,
  `return reply.send({ question, date: today, dayTimeZone, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered, waitingForPartner: Boolean(mine && !bothAnswered), disabledCategories });`,
  'daily-question success response'
);

replaceOnce(
  'server/src/routes/together.ts',
  `      const today = new Date().toISOString().slice(0, 10);
      const answeredToday = await pool.query(`,
  `      const { today } = await loadTodaysQuestion(coupleId);
      const answeredToday = await pool.query(`,
  'daily-question settings lock day'
);

// ------------------------------------------------------------
// WATCH
// ------------------------------------------------------------
ensureImport(
  'server/src/routes/watch.ts',
  `import { dateKeyInTimeZone } from '../utils/sharedDay.js';`,
  `import { ApiError, sendError } from '../utils/http.js';`
);

replaceOnce(
  'server/src/routes/watch.ts',
  `const couple = await pool.query('SELECT relationship_start_date,anniversary_date,long_distance_enabled FROM couples WHERE id=$1', [coupleId]);`,
  `const couple = await pool.query('SELECT relationship_start_date,anniversary_date,long_distance_enabled,shared_day_timezone FROM couples WHERE id=$1', [coupleId]);`,
  'watch loads shared-day timezone'
);

replaceOnce(
  'server/src/routes/watch.ts',
  `const questionDay = new Date().toISOString().slice(0, 10);`,
  `const questionDay = dateKeyInTimeZone(String(couple.rows[0]?.shared_day_timezone || 'UTC'));`,
  'watch shared question day'
);

// ------------------------------------------------------------
// WORKSPACE
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/workspace.ts',
  `const profile = await client.query('SELECT preferred_participant_color FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);`,
  `const profile = await client.query('SELECT preferred_participant_color,timezone FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);`,
  'workspace creator timezone'
);

replaceOnce(
  'server/src/routes/workspace.ts',
  `'INSERT INTO couples(id, relationship_start_date, long_distance_enabled, owner_user_id) VALUES($1, $2, $3, $4)',
        [coupleId, relationshipStartDate, longDistanceEnabled, request.userId],`,
  `'INSERT INTO couples(id, relationship_start_date, long_distance_enabled, owner_user_id, shared_day_timezone) VALUES($1, $2, $3, $4, $5)',
        [coupleId, relationshipStartDate, longDistanceEnabled, request.userId, String(profile.rows[0].timezone || 'UTC')],`,
  'workspace freezes shared-day timezone'
);

// ------------------------------------------------------------
// FINAL AUDIT
// ------------------------------------------------------------
const checks = [
  ['server/migrations/015_activity_shared_day.sql', 'is_favourite boolean'],
  ['server/migrations/015_activity_shared_day.sql', 'shared_day_timezone'],
  ['src/types/database.ts', 'is_favourite: boolean'],
  ['src/types/database.ts', 'shared_day_timezone: string'],
  ['src/services/backend/mvpFeatures.ts', 'setActivityFavourite'],
  ['src/app/features/activities.tsx', 'async function toggleFavourite'],
  ['src/app/features/activities.tsx', `filter === 'favourite' ? activity.is_favourite`],
  ['src/app/features/activity-randomizer.tsx', `pick.is_favourite`],
  ['server/src/routes/together.ts', `app.post('/activities/:id/favourite'`],
  ['server/src/routes/together.ts', `a.status IN ('want_to_do','planned','do_again')`],
  ['server/src/routes/together.ts', 'dateKeyInTimeZone(dayTimeZone)'],
  ['server/src/routes/watch.ts', 'shared_day_timezone'],
  ['server/src/routes/workspace.ts', 'shared_day_timezone) VALUES'],
  ['server/src/utils/sharedDay.ts', 'dateKeyInTimeZone'],
];

const missing = checks
  .filter(([rel, marker]) => !read(rel).includes(marker))
  .map(([rel, marker]) => `${rel}: missing ${marker}`);

if (missing.length) {
  fs.writeFileSync(p('RELEASE_C3_RESUME_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`C3 resume audit found ${missing.length} issue(s). See RELEASE_C3_RESUME_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_C3_RESUME_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('C3 resume audit clean.');
}

console.log('');
console.log('C3 resume repair complete.');
console.log('IMPORTANT: migration 015 has not been assumed applied yet.');
console.log('Now run:');
console.log('  npm.cmd run backend:migrate');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
