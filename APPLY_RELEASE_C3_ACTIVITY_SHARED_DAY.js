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
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}: ${statement}`);
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
function insertAfter(rel, marker, addition, alreadyMarker, label) {
  let text = read(rel);
  if (alreadyMarker && text.includes(alreadyMarker)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(marker);
  if (i < 0) throw new Error(`Could not find insertion point in ${rel}: ${label}`);
  text = text.slice(0, i + marker.length) + addition + text.slice(i + marker.length);
  write(rel, text);
}

// Verify C2 is really present.
for (const [rel, marker] of [
  ['server/migrations/014_trip_goal_integrity.sql', 'managed_by_trip boolean'],
  ['server/src/routes/planning.ts', 'Goal progress is history-backed'],
  ['src/app/features/trip-detail.tsx', 'SYNCED TO TRIP'],
]) {
  if (!read(rel).includes(marker)) throw new Error(`${rel} is not the expected C2 baseline. Missing: ${marker}`);
}

write('server/migrations/015_activity_shared_day.sql', "-- Togetherly Release C3: independent activity favourites + stable shared-day timezone.\n\nALTER TABLE activities\n  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;\n\n-- Old builds stored Favourite as the lifecycle status itself. Preserve the\n-- favourite flag, then return the item to the ordinary idea lifecycle.\nUPDATE activities\nSET is_favourite = true,\n    status = 'want_to_do',\n    updated_at = now()\nWHERE status = 'favourite';\n\nALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;\nALTER TABLE activities\n  ADD CONSTRAINT activities_status_check\n  CHECK (status IN ('want_to_do', 'planned', 'completed', 'do_again', 'skip'));\n\nALTER TABLE couples\n  ADD COLUMN IF NOT EXISTS shared_day_timezone text;\n\n-- Freeze the relationship's daily-question boundary to the timezone of the\n-- current owner at upgrade time. It no longer changes at UTC midnight or when\n-- the two partners happen to be in different local dates.\nUPDATE couples c\nSET shared_day_timezone = COALESCE(NULLIF(u.timezone, ''), 'UTC')\nFROM users u\nWHERE c.owner_user_id = u.id\n  AND (c.shared_day_timezone IS NULL OR btrim(c.shared_day_timezone) = '');\n\nUPDATE couples\nSET shared_day_timezone = 'UTC'\nWHERE shared_day_timezone IS NULL OR btrim(shared_day_timezone) = '';\n\nALTER TABLE couples\n  ALTER COLUMN shared_day_timezone SET DEFAULT 'UTC',\n  ALTER COLUMN shared_day_timezone SET NOT NULL;\n");
write('server/src/utils/sharedDay.ts', "export function dateKeyInTimeZone(timeZone: string, date = new Date()) {\n  try {\n    const parts = Object.fromEntries(\n      new Intl.DateTimeFormat('en-CA', {\n        timeZone,\n        year: 'numeric',\n        month: '2-digit',\n        day: '2-digit',\n      }).formatToParts(date).map((part) => [part.type, part.value]),\n    );\n    if (parts.year && parts.month && parts.day) return `${parts.year}-${parts.month}-${parts.day}`;\n  } catch {\n    // Invalid/stale timezone data should never split the couple onto different\n    // question days. UTC is the deterministic fallback.\n  }\n  return date.toISOString().slice(0, 10);\n}\n");

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------
replaceOnce(
  'src/types/database.ts',
  `export type Couple = {
  id: string;
  relationship_start_date: string | null;`,
  `export type Couple = {
  id: string;
  relationship_start_date: string | null;`,
  'couple type anchor'
);
insertAfter(
  'src/types/database.ts',
  `  long_distance_enabled: boolean;`,
  `
  shared_day_timezone: string;`,
  `shared_day_timezone: string;`,
  'couple shared-day timezone type'
);

replaceOnce(
  'src/types/database.ts',
  `export type ActivityStatus = 'want_to_do' | 'planned' | 'completed' | 'favourite' | 'do_again' | 'skip';`,
  `export type ActivityStatus = 'want_to_do' | 'planned' | 'completed' | 'do_again' | 'skip';`,
  'remove favourite from lifecycle status'
);
insertAfter(
  'src/types/database.ts',
  `  status: ActivityStatus;`,
  `
  is_favourite: boolean;`,
  `is_favourite: boolean;`,
  'activity favourite type'
);
insertAfter(
  'src/types/database.ts',
  `  date?: string;`,
  `
  dayTimeZone?: string;`,
  `dayTimeZone?: string;`,
  'daily question timezone type'
);

// ------------------------------------------------------------
// CLIENT API
// ------------------------------------------------------------
insertAfter(
  'src/services/backend/mvpFeatures.ts',
  `export async function setActivityInterest(id: string, interested: boolean) { return apiRequest<{ interested: boolean }>(\`/activities/\${id}/interest\`, { method: 'POST', body: { interested } }); }`,
  `
export async function setActivityFavourite(id: string, favourite: boolean) { return (await apiRequest<{ activity: CoupleActivity }>(\`/activities/\${id}/favourite\`, { method: 'POST', body: { favourite } })).activity; }`,
  `setActivityFavourite`,
  'activity favourite API'
);

// ------------------------------------------------------------
// ACTIVITIES SCREEN
// ------------------------------------------------------------
replaceOnce(
  'src/app/features/activities.tsx',
  `import { createActivity, deleteActivity, getActivities, getTags, setActivityInterest, updateActivity } from '@/services/backend/mvpFeatures';`,
  `import { createActivity, deleteActivity, getActivities, getTags, setActivityFavourite, setActivityInterest, updateActivity } from '@/services/backend/mvpFeatures';`,
  'activity favourite import'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `const visible = useMemo(() => activities.filter((activity) => filter === 'all' || activity.status === filter), [activities, filter]);`,
  `const visible = useMemo(() => activities.filter((activity) => filter === 'all' || (filter === 'favourite' ? activity.is_favourite : activity.status === filter)), [activities, filter]);`,
  'favourite filter independent from lifecycle'
);
insertAfter(
  'src/app/features/activities.tsx',
  `  async function toggleInterest(activity: CoupleActivity) { if (!profile) return; const current = activity.interests?.[profile.id] ?? false; try { await setActivityInterest(activity.id, !current); await refresh(); } catch (error) { Alert.alert('Couldn’t update interest', messageFrom(error)); } }`,
  `
  async function toggleFavourite(activity: CoupleActivity) { try { await setActivityFavourite(activity.id, !activity.is_favourite); await refresh(); } catch (error) { Alert.alert('Couldn’t update favourite', messageFrom(error)); } }`,
  `async function toggleFavourite(activity: CoupleActivity)`,
  'activity favourite helper'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `      { text: activity.status === 'favourite' ? 'Remove favourite' : 'Favourite', onPress: () => setStatus(activity, activity.status === 'favourite' ? 'want_to_do' : 'favourite') },
      { text: activity.status === 'completed' ? 'Move back to ideas' : 'Mark as done', onPress: () => setStatus(activity, activity.status === 'completed' ? 'want_to_do' : 'completed') },`,
  `      { text: activity.is_favourite ? 'Remove favourite' : 'Favourite', onPress: () => toggleFavourite(activity) },
      { text: activity.status === 'completed' ? 'Do this again' : activity.status === 'do_again' ? 'Move back to ideas' : 'Mark as done', onPress: () => setStatus(activity, activity.status === 'completed' ? 'do_again' : activity.status === 'do_again' ? 'want_to_do' : 'completed') },`,
  'activity menu lifecycle/favourite split'
);
insertAfter(
  'src/app/features/activities.tsx',
  `<TagChip subtle label={activity.cost_level.toUpperCase()} /><TagChip subtle label={durationLabel(activity.duration_minutes).toUpperCase()} /><TagChip subtle label={activity.location_type.toUpperCase()} />`,
  `{activity.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}`,
  `★ FAVOURITE`,
  'activity favourite chip'
);
insertAfter(
  'src/app/features/activities.tsx',
  `{viewTarget.booking_required ? <TagChip subtle label="BOOKING NEEDED" /> : null}`,
  `
          {viewTarget.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}
          <TagChip subtle label={viewTarget.status.replace('_', ' ').toUpperCase()} />`,
  `viewTarget.is_favourite ? <TagChip`,
  'activity detail lifecycle chips'
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
replaceOnce(
  'src/app/features/activity-randomizer.tsx',
  `  async function choose(status: 'favourite') {
    if (!pick) return;
    try { const updated = await updateActivity(pick.id, { status }); setPick({ ...pick, ...updated }); }
    catch (error) { Alert.alert('Couldn’t update activity', messageFrom(error)); }
  }`,
  `  async function toggleFavourite() {
    if (!pick) return;
    try { const updated = await setActivityFavourite(pick.id, !pick.is_favourite); setPick({ ...pick, ...updated }); }
    catch (error) { Alert.alert('Couldn’t update favourite', messageFrom(error)); }
  }`,
  'randomizer favourite helper'
);
replaceOnce(
  'src/app/features/activity-randomizer.tsx',
  `<AppButton label={pick.status === 'favourite' ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={() => choose('favourite')} />`,
  `<AppButton label={pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={toggleFavourite} />`,
  'randomizer favourite button'
);

// ------------------------------------------------------------
// TOGETHER SERVER: lifecycle statuses + favourite endpoint.
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/together.ts',
  `const activityStatuses = ['want_to_do', 'planned', 'completed', 'favourite', 'do_again', 'skip'] as const;`,
  `const activityStatuses = ['want_to_do', 'planned', 'completed', 'do_again', 'skip'] as const;`,
  'server activity statuses'
);

insertAfter(
  'server/src/routes/together.ts',
  `  app.post('/activities/:id/interest', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const exists = await pool.query('SELECT id FROM activities WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!exists.rowCount) throw new ApiError(404, 'Activity not found.');
      const body = request.body as Record<string, unknown>;
      const interested = body.interested !== false;
      await pool.query(\`INSERT INTO activity_interests(activity_id,user_id,interested) VALUES($1,$2,$3)
        ON CONFLICT(activity_id,user_id) DO UPDATE SET interested=EXCLUDED.interested,updated_at=now()\`, [id, request.userId, interested]);
      broadcast(realtime, coupleId, 'activities', 'interest', id);
      return reply.send({ interested });
    } catch (error) { return sendError(reply, error); }
  });`,
  `

  app.post('/activities/:id/favourite', { preHandler: authenticate }, async (request, reply) => {
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
  });`,
  `app.post('/activities/:id/favourite'`,
  'server favourite endpoint'
);

replaceOnce(
  'server/src/routes/together.ts',
  `${activitySelect()} WHERE a.couple_id=$1 AND a.status <> 'skip'`,
  `${activitySelect()} WHERE a.couple_id=$1 AND a.status IN ('want_to_do','planned','do_again')`,
  'randomizer respects lifecycle'
);

// ------------------------------------------------------------
// SHARED DAILY QUESTION DAY: fixed relationship timezone, not UTC.
// ------------------------------------------------------------
ensureImport(
  'server/src/routes/together.ts',
  `import { dateKeyInTimeZone } from '../utils/sharedDay.js';`,
  `import { ApiError, sendError } from '../utils/http.js';`
);

replaceOnce(
  'server/src/routes/together.ts',
  `async function loadTodaysQuestion(coupleId: string) {
  const coupleResult = await pool.query('SELECT disabled_question_categories FROM couples WHERE id=$1', [coupleId]);
  const disabledCategories = Array.isArray(coupleResult.rows[0]?.disabled_question_categories)
    ? coupleResult.rows[0].disabled_question_categories as string[]
    : [];
  const questions = await pool.query(
    'SELECT id,question,category FROM questions WHERE enabled=true AND NOT(category = ANY($1::text[])) ORDER BY id',
    [disabledCategories],
  );
  const today = new Date().toISOString().slice(0, 10);
  if (!questions.rowCount) return { question: null, today, disabledCategories };
  const dayNumber = Math.floor(Date.parse(\`\${today}T00:00:00Z\`) / 86_400_000);
  return { question: questions.rows[dayNumber % questions.rows.length], today, disabledCategories };
}`,
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
}`,
  'shared daily-question day'
);

replaceOnce(
  'server/src/routes/together.ts',
  `const { question, today, disabledCategories } = await loadTodaysQuestion(coupleId);
      if (!question) return reply.send({ question: null, date: today, myAnswer: null, partnerAnswer: null, bothAnswered: false, disabledCategories });`,
  `const { question, today, dayTimeZone, disabledCategories } = await loadTodaysQuestion(coupleId);
      if (!question) return reply.send({ question: null, date: today, dayTimeZone, myAnswer: null, partnerAnswer: null, bothAnswered: false, disabledCategories });`,
  'daily-question response timezone'
);
replaceOnce(
  'server/src/routes/together.ts',
  `return reply.send({ question, date: today, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered, waitingForPartner: Boolean(mine && !bothAnswered), disabledCategories });`,
  `return reply.send({ question, date: today, dayTimeZone, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered, waitingForPartner: Boolean(mine && !bothAnswered), disabledCategories });`,
  'daily-question success response timezone'
);

replaceOnce(
  'server/src/routes/together.ts',
  `      const today = new Date().toISOString().slice(0, 10);
      const answeredToday = await pool.query(`,
  `      const { today } = await loadTodaysQuestion(coupleId);
      const answeredToday = await pool.query(`,
  'question settings uses shared day'
);

// ------------------------------------------------------------
// WATCH: use the same shared day as phone.
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
  'watch loads shared day timezone'
);
replaceOnce(
  'server/src/routes/watch.ts',
  `const questionDay = new Date().toISOString().slice(0, 10);`,
  `const questionDay = dateKeyInTimeZone(String(couple.rows[0]?.shared_day_timezone || 'UTC'));`,
  'watch shared question day'
);

// ------------------------------------------------------------
// WORKSPACE: new couples freeze the creator's current timezone as
// the relationship's shared-day boundary.
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/workspace.ts',
  `const profile = await client.query('SELECT preferred_participant_color FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);`,
  `const profile = await client.query('SELECT preferred_participant_color,timezone FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);`,
  'workspace loads creator timezone'
);
replaceOnce(
  'server/src/routes/workspace.ts',
  `'INSERT INTO couples(id, relationship_start_date, long_distance_enabled, owner_user_id) VALUES($1, $2, $3, $4)',
        [coupleId, relationshipStartDate, longDistanceEnabled, request.userId],`,
  `'INSERT INTO couples(id, relationship_start_date, long_distance_enabled, owner_user_id, shared_day_timezone) VALUES($1, $2, $3, $4, $5)',
        [coupleId, relationshipStartDate, longDistanceEnabled, request.userId, String(profile.rows[0].timezone || 'UTC')],`,
  'new couple shared day timezone'
);

// ------------------------------------------------------------
// STATIC AUDIT
// ------------------------------------------------------------
const checks = [
  ['server/migrations/015_activity_shared_day.sql', 'is_favourite boolean'],
  ['server/migrations/015_activity_shared_day.sql', 'shared_day_timezone'],
  ['src/types/database.ts', 'is_favourite: boolean'],
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
  fs.writeFileSync(p('RELEASE_C3_ACTIVITY_SHARED_DAY_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`C3 audit found ${missing.length} issue(s). See RELEASE_C3_ACTIVITY_SHARED_DAY_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_C3_ACTIVITY_SHARED_DAY_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('C3 activity/shared-day audit clean.');
}

console.log('');
console.log('Release C3 applied.');
console.log('IMPORTANT: this release includes migration 015.');
console.log('Run:');
console.log('  npm.cmd run backend:migrate');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
