import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { authenticateWatch, createWatchSession, revokeWatchSessions } from '../auth/watch.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, notifyPartner, oneOf, requireCoupleId } from './helpers.js';

const watchPreHandler = authenticateWatch;
const moodValues = ['amazing','good','okay','low','frustrated','overwhelmed','tired','stressed'] as const;
const needValues = ['affection','reassurance','advice','listen','distraction','space','call','nothing'] as const;
const pingKinds = ['love','thinking_of_you'] as const;

function datePartsInZone(timeZone: string, date = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    return {
      dateKey,
      dayOfWeek: new Date(`${dateKey}T00:00:00Z`).getUTCDay(),
      minuteOfDay: Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0),
      localTime: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    return { dateKey: date.toISOString().slice(0, 10), dayOfWeek: date.getUTCDay(), minuteOfDay: date.getUTCHours() * 60 + date.getUTCMinutes(), localTime: date.toISOString().slice(11, 16) };
  }
}

function scheduleActive(row: Record<string, unknown>, dayOfWeek: number, minute: number) {
  const rowDay = Number(row.day_of_week);
  const start = Number(row.start_minute);
  const end = Number(row.end_minute);
  if (end > start) return rowDay === dayOfWeek && minute >= start && minute < end;
  const previousDay = (dayOfWeek + 6) % 7;
  return (rowDay === dayOfWeek && minute >= start) || (rowDay === previousDay && minute < end);
}

function scheduleLabel(kind: string | null, label: string | null) {
  if (!kind) return null;
  if (kind === 'sleep') return 'Sleeping';
  if (kind === 'work') return label && label.toLowerCase() !== 'work' ? label : 'At work';
  if (kind === 'busy') return label || 'Busy';
  if (kind === 'free') return label && label.toLowerCase() !== 'free' ? label : 'Free';
  return label;
}

async function loadWatchState(userId: string) {
  const coupleId = await requireCoupleId(userId);
  const members = await pool.query(
    `SELECT cm.user_id,cm.participant_color,u.display_name,u.timezone,u.avatar_url
     FROM couple_members cm JOIN users u ON u.id=cm.user_id
     WHERE cm.couple_id=$1 ORDER BY cm.joined_at`, [coupleId],
  );
  const me = members.rows.find((row) => String(row.user_id) === userId);
  const partner = members.rows.find((row) => String(row.user_id) !== userId);
  if (!me || !partner) throw new ApiError(409, 'Link your partner before using Togetherly on Apple Watch.');

  const partnerParts = datePartsInZone(String(partner.timezone || 'UTC'));
  const schedules = await pool.query('SELECT label,kind,day_of_week,start_minute,end_minute FROM user_schedules WHERE couple_id=$1 AND user_id=$2 AND enabled=true', [coupleId, partner.user_id]);
  const priority: Record<string, number> = { sleep: 4, work: 3, busy: 2, free: 1 };
  const activeSchedule = schedules.rows
    .filter((row) => scheduleActive(row, partnerParts.dayOfWeek, partnerParts.minuteOfDay))
    .sort((a, b) => (priority[String(b.kind)] ?? 0) - (priority[String(a.kind)] ?? 0))[0] ?? null;

  const mood = await pool.query(
    `SELECT id,mood,need,created_at FROM moods
     WHERE couple_id=$1 AND user_id=$2 AND visibility='shared' AND created_at >= now() - interval '36 hours'
     ORDER BY created_at DESC LIMIT 1`, [coupleId, partner.user_id],
  );

  const couple = await pool.query('SELECT relationship_start_date,anniversary_date,long_distance_enabled FROM couples WHERE id=$1', [coupleId]);
  const nextVisit = await pool.query(
    `SELECT id,title,target_at,type FROM countdowns
     WHERE couple_id=$1 AND type IN ('visit','flight') AND target_at >= now()
     ORDER BY target_at LIMIT 1`, [coupleId],
  );

  const disabled = await pool.query('SELECT disabled_question_categories FROM couples WHERE id=$1', [coupleId]);
  const disabledCategories = Array.isArray(disabled.rows[0]?.disabled_question_categories) ? disabled.rows[0].disabled_question_categories as string[] : [];
  const questions = await pool.query('SELECT id,question,category FROM questions WHERE enabled=true AND NOT(category = ANY($1::text[])) ORDER BY id', [disabledCategories]);
  const questionDay = new Date().toISOString().slice(0, 10);
  let question = null as Record<string, unknown> | null;
  if (questions.rows.length) {
    const dayNumber = Math.floor(Date.parse(`${questionDay}T00:00:00Z`) / 86_400_000);
    question = questions.rows[dayNumber % questions.rows.length] ?? null;
  }
  const answers = question ? await pool.query(
    `SELECT user_id FROM question_answers WHERE couple_id=$1 AND question_id=$2 AND answer_date=$3`,
    [coupleId, question.id, questionDay],
  ) : { rows: [] as Record<string, unknown>[] };
  const meAnswered = answers.rows.some((row) => String(row.user_id) === userId);
  const partnerAnswered = answers.rows.some((row) => String(row.user_id) === String(partner.user_id));

  let relationshipDays: number | null = null;
  const relationshipStart = couple.rows[0]?.relationship_start_date ? String(couple.rows[0].relationship_start_date) : null;
  if (relationshipStart) {
    const start = Date.parse(`${relationshipStart.slice(0, 10)}T00:00:00Z`);
    if (Number.isFinite(start)) relationshipDays = Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
  }

  return {
    serverTime: new Date().toISOString(),
    me: { id: String(me.user_id), name: String(me.display_name), color: me.participant_color ?? 'purple' },
    partner: {
      id: String(partner.user_id), name: String(partner.display_name), color: partner.participant_color ?? 'green', timezone: String(partner.timezone || 'UTC'),
      localTime: partnerParts.localTime,
      status: activeSchedule ? { kind: String(activeSchedule.kind), label: scheduleLabel(String(activeSchedule.kind), activeSchedule.label ? String(activeSchedule.label) : null) } : null,
      mood: mood.rows[0] ?? null,
    },
    relationship: { days: relationshipDays, startDate: relationshipStart, anniversaryDate: couple.rows[0]?.anniversary_date ?? null, longDistance: couple.rows[0]?.long_distance_enabled === true },
    nextVisit: nextVisit.rows[0] ?? null,
    dailyQuestion: { question, meAnswered, partnerAnswered, bothAnswered: meAnswered && partnerAnswered },
  };
}

async function createPing(userId: string, kind: typeof pingKinds[number], source: 'phone' | 'watch' | 'widget') {
  const coupleId = await requireCoupleId(userId);
  const people = await pool.query(
    `SELECT cm.user_id,u.display_name FROM couple_members cm JOIN users u ON u.id=cm.user_id WHERE cm.couple_id=$1`, [coupleId],
  );
  const sender = people.rows.find((row) => String(row.user_id) === userId);
  const recipient = people.rows.find((row) => String(row.user_id) !== userId);
  if (!sender || !recipient) throw new ApiError(409, 'Link your partner first.');
  const lastPing = await pool.query(`SELECT created_at FROM relationship_pings WHERE sender_user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]);
  const lastPingAt = lastPing.rows[0]?.created_at ? new Date(lastPing.rows[0].created_at).getTime() : 0;
  if (lastPingAt && Date.now() - lastPingAt < 3_000) throw new ApiError(429, 'A tiny pause keeps love taps special.');
  const pingId = randomUUID();
  await pool.query(
    `INSERT INTO relationship_pings(id,couple_id,sender_user_id,recipient_user_id,kind,source) VALUES($1,$2,$3,$4,$5,$6)`,
    [pingId, coupleId, userId, recipient.user_id, kind, source],
  );
  const senderName = String(sender.display_name);
  await notifyPartner({
    coupleId, actorUserId: userId, kind, preference: 'notification_relationship_pings', entityType: 'relationship_ping', entityId: pingId,
    title: kind === 'love' ? `Love from ${senderName}` : `${senderName} is thinking of you`,
    body: kind === 'love' ? 'A little love tap, just for you.' : 'You crossed their mind ✦',
  });
  return { id: pingId, kind, recipientUserId: String(recipient.user_id), coupleId };
}

export async function registerWatchRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.post('/watch/session', { preHandler: authenticate }, async (request, reply) => {
    try {
      await requireCoupleId(request.userId);
      const body = request.body as { deviceName?: unknown } | null;
      const deviceName = typeof body?.deviceName === 'string' && body.deviceName.trim() ? body.deviceName.trim() : 'Apple Watch';
      const session = await createWatchSession(request.userId, deviceName);
      return reply.code(201).send({ watchSession: session });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/watch/sessions', { preHandler: authenticate }, async (request, reply) => {
    try { await revokeWatchSessions(request.userId); return reply.code(204).send(); }
    catch (error) { return sendError(reply, error); }
  });

  app.get('/watch/state/phone', { preHandler: authenticate }, async (request, reply) => {
    try { return reply.send({ state: await loadWatchState(request.userId) }); }
    catch (error) { return sendError(reply, error); }
  });

  app.get('/watch/state', { preHandler: watchPreHandler }, async (request, reply) => {
    try { return reply.send({ state: await loadWatchState(request.userId) }); }
    catch (error) { return sendError(reply, error); }
  });

  app.post('/watch/ping', { preHandler: watchPreHandler }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const kind = oneOf(body.kind, pingKinds, 'love');
      const source = oneOf(body.source, ['watch','widget'] as const, 'watch');
      const ping = await createPing(request.userId, kind, source);
      broadcast(realtime, ping.coupleId, 'relationship_pings', 'created', ping.id);
      return reply.code(201).send({ ping, state: await loadWatchState(request.userId) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/relationship-pings', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const kind = oneOf(body.kind, pingKinds, 'love');
      const ping = await createPing(request.userId, kind, 'phone');
      broadcast(realtime, ping.coupleId, 'relationship_pings', 'created', ping.id);
      return reply.code(201).send({ ping });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/watch/check-in', { preHandler: watchPreHandler }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const mood = oneOf(body.mood, moodValues, 'okay');
      const need = oneOf(body.need, needValues, 'nothing');
      const result = await pool.query(
        `INSERT INTO moods(id,user_id,couple_id,mood,need,visibility) VALUES($1,$2,$3,$4,$5,'shared') RETURNING *`,
        [randomUUID(), request.userId, coupleId, mood, need],
      );
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'mood', preference: 'notification_partner_mood', entityType: 'mood', entityId: result.rows[0].id, title: 'Partner check-in', body: `${mood} · ${need}` });
      broadcast(realtime, coupleId, 'moods', 'created', result.rows[0].id);
      return reply.code(201).send({ mood: result.rows[0], state: await loadWatchState(request.userId) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/watch/acknowledge', { preHandler: watchPreHandler }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const moodId = typeof body.moodId === 'string' ? body.moodId : '';
      if (!/^[0-9a-f-]{36}$/i.test(moodId)) throw new ApiError(400, 'Mood is invalid.');
      const mood = await pool.query(`SELECT id,user_id FROM moods WHERE id=$1 AND couple_id=$2 AND visibility='shared'`, [moodId, coupleId]);
      if (!mood.rows[0] || String(mood.rows[0].user_id) === request.userId) throw new ApiError(404, 'Partner check-in not found.');
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'mood', preference: 'notification_partner_mood', entityType: 'mood', entityId: moodId, title: 'I’m here for you', body: 'Your partner saw your check-in and sent some support.' });
      return reply.send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });
}
