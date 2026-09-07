import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { dispatchPush } from '../push/expo.js';

type ReminderKind = 'task' | 'event' | 'countdown' | 'daily_question' | 'goal' | 'visit';

type ReminderInput = {
  coupleId: string;
  recipientUserId: string;
  kind: ReminderKind;
  entityType: string | null;
  entityId: string | null;
  title: string;
  body: string;
  dedupeKey: string;
};

async function insertReminder(input: ReminderInput) {
  const result = await pool.query(
    `INSERT INTO notifications(id,couple_id,recipient_user_id,actor_user_id,kind,entity_type,entity_id,title,body,dedupe_key)
     VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9)
     ON CONFLICT DO NOTHING
     RETURNING id,recipient_user_id,kind,entity_type,entity_id,title,body`,
    [randomUUID(), input.coupleId, input.recipientUserId, input.kind, input.entityType, input.entityId, input.title, input.body, input.dedupeKey],
  );
  if (result.rows[0]) dispatchPush(result.rows[0]);
  return Boolean(result.rowCount);
}

function localParts(timeZone: string, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return {
      date: `${value('year')}-${value('month')}-${value('day')}`,
      hour: Number(value('hour') || 0),
    };
  } catch {
    return { date: date.toISOString().slice(0, 10), hour: date.getUTCHours() };
  }
}

function dateOnlyDifference(targetDate: string, localToday: string) {
  const target = Date.parse(`${targetDate}T00:00:00Z`);
  const today = Date.parse(`${localToday}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return Number.POSITIVE_INFINITY;
  return Math.round((target - today) / 86_400_000);
}

function daysUntil(value: string | Date) {
  const target = new Date(value).getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export async function runReminderSweepForUser(userId: string) {
  const userResult = await pool.query(
    `SELECT u.id,u.timezone,cm.couple_id,
      COALESCE(up.notification_events,true) AS notification_events,
      COALESCE(up.notification_tasks,true) AS notification_tasks,
      COALESCE(up.notification_countdowns,true) AS notification_countdowns,
      COALESCE(up.notification_daily_question,true) AS notification_daily_question,
      COALESCE(up.notification_goal_milestones,true) AS notification_goal_milestones,
      COALESCE(up.notification_visit_approaching,true) AS notification_visit_approaching
     FROM users u
     JOIN couple_members cm ON cm.user_id=u.id
     LEFT JOIN user_preferences up ON up.user_id=u.id
     WHERE u.id=$1 AND u.deleted_at IS NULL`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) return { created: 0 };

  const coupleId = String(user.couple_id);
  const local = localParts(String(user.timezone || 'UTC'));
  let created = 0;

  if (user.notification_tasks) {
    const tasks = await pool.query(
      `SELECT id,title,due_at FROM tasks
       WHERE couple_id=$1 AND status IN ('not_started','in_progress') AND due_at IS NOT NULL
         AND due_at >= now() AND due_at <= now() + interval '24 hours'
         AND (assign_to_both=true OR assignee_id=$2)`,
      [coupleId, userId],
    );
    for (const task of tasks.rows) {
      if (await insertReminder({
        coupleId,
        recipientUserId: userId,
        kind: 'task',
        entityType: 'task',
        entityId: String(task.id),
        title: 'Task due soon',
        body: String(task.title),
        dedupeKey: `task-due:${task.id}:${new Date(task.due_at).toISOString()}`,
      })) created += 1;
    }
  }

  if (user.notification_events) {
    const events = await pool.query(
      `SELECT id,title,start_at FROM events
       WHERE couple_id=$1 AND start_at >= now() AND start_at <= now() + interval '24 hours'
         AND (assign_to_both=true OR assigned_user_id=$2)`,
      [coupleId, userId],
    );
    for (const event of events.rows) {
      if (await insertReminder({
        coupleId,
        recipientUserId: userId,
        kind: 'event',
        entityType: 'event',
        entityId: String(event.id),
        title: 'Coming up',
        body: String(event.title),
        dedupeKey: `event-upcoming:${event.id}:${new Date(event.start_at).toISOString()}`,
      })) created += 1;
    }
  }

  const countdowns = await pool.query(
    `SELECT id,title,target_at,type FROM countdowns
     WHERE couple_id=$1 AND target_at >= now() AND target_at <= now() + interval '101 days'`,
    [coupleId],
  );
  const thresholds = new Set([100, 60, 30, 14, 7, 3, 1, 0]);
  for (const countdown of countdowns.rows) {
    const remaining = daysUntil(countdown.target_at);
    if (!thresholds.has(remaining)) continue;
    const isVisit = countdown.type === 'visit' || countdown.type === 'flight';
    if (isVisit ? !user.notification_visit_approaching : !user.notification_countdowns) continue;
    const when = remaining === 0 ? 'today' : remaining === 1 ? 'tomorrow' : `in ${remaining} days`;
    if (await insertReminder({
      coupleId,
      recipientUserId: userId,
      kind: isVisit ? 'visit' : 'countdown',
      entityType: 'countdown',
      entityId: String(countdown.id),
      title: isVisit ? 'Your visit is getting close' : 'Countdown milestone',
      body: `${countdown.title} · ${when}`,
      dedupeKey: `countdown:${countdown.id}:${new Date(countdown.target_at).toISOString()}:${remaining}`,
    })) created += 1;
  }

  if (user.notification_goal_milestones) {
    // Query one day wider than the local window so server/database timezone differences
    // cannot make a user's local "today" disappear around midnight.
    const goals = await pool.query(
      `SELECT id,title,deadline FROM goals
       WHERE couple_id=$1 AND status='active' AND deadline IS NOT NULL
         AND deadline >= CURRENT_DATE - 1 AND deadline <= CURRENT_DATE + 8`,
      [coupleId],
    );
    for (const goal of goals.rows) {
      const remaining = dateOnlyDifference(String(goal.deadline), local.date);
      if (!Number.isFinite(remaining) || remaining < 0 || remaining > 7) continue;
      if (await insertReminder({
        coupleId,
        recipientUserId: userId,
        kind: 'goal',
        entityType: 'goal',
        entityId: String(goal.id),
        title: 'Goal deadline approaching',
        body: `${goal.title} · ${remaining === 0 ? 'due today' : `${remaining} day${remaining === 1 ? '' : 's'} left`}`,
        dedupeKey: `goal-deadline:${goal.id}:${goal.deadline}:${remaining}`,
      })) created += 1;
    }
  }

  if (user.notification_daily_question && local.hour >= 8) {
    // Daily Question itself is intentionally couple-wide and currently rolls over on
    // one shared UTC date, so reminder dedupe/answer checks use the same date key.
    const questionDay = new Date().toISOString().slice(0, 10);
    const answered = await pool.query(
      'SELECT 1 FROM question_answers WHERE user_id=$1 AND couple_id=$2 AND answer_date=$3 LIMIT 1',
      [userId, coupleId, questionDay],
    );
    if (!answered.rowCount && await insertReminder({
      coupleId,
      recipientUserId: userId,
      kind: 'daily_question',
      entityType: 'question',
      entityId: null,
      title: 'Today’s question is ready',
      body: 'Take a minute to answer together.',
      dedupeKey: `daily-question:${questionDay}`,
    })) created += 1;
  }

  return { created };
}

export async function runReminderSweep() {
  const users = await pool.query('SELECT DISTINCT u.id FROM users u JOIN couple_members cm ON cm.user_id=u.id WHERE u.deleted_at IS NULL');
  for (const row of users.rows) {
    try { await runReminderSweepForUser(String(row.id)); }
    catch (error) { console.warn('Reminder sweep failed for one account:', error); }
  }
}

export function startReminderScheduler(intervalMs = 30 * 60_000) {
  let stopped = false;
  const run = () => { if (!stopped) runReminderSweep().catch((error) => console.error('Reminder sweep failed:', error)); };
  const initial = setTimeout(run, 5_000);
  const timer = setInterval(run, intervalMs);
  return () => { stopped = true; clearTimeout(initial); clearInterval(timer); };
}
