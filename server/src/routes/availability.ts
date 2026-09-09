import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, oneOf, requiredText, requireCoupleId } from './helpers.js';

type ScheduleKind = 'free' | 'work' | 'sleep' | 'busy';
type ScheduleRow = {
  id: string; user_id: string; day_of_week: number; start_minute: number; end_minute: number; kind: ScheduleKind; enabled: boolean;
};

function integer(value: unknown, label: string, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ApiError(400, `${label} is invalid.`);
  return parsed;
}

function dateKeyInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new ApiError(500, 'Availability produced an invalid calendar date.');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function addDays(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function weekday(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function zonedLocalToUtc(dateKey: string, minuteOfDay: number, timezone: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(desired);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let pass = 0; pass < 4; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(guess).map((part) => [part.type, part.value]));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), 0, 0);
    const diff = desired - observed;
    if (Math.abs(diff) < 30_000) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

type Interval = { start: Date; end: Date };

function mergeIntervals(intervals: Interval[]) {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start.getTime() <= previous.end.getTime()) {
      if (interval.end > previous.end) previous.end = new Date(interval.end);
    } else {
      merged.push({ start: new Date(interval.start), end: new Date(interval.end) });
    }
  }
  return merged;
}

function scheduleIntervals(rows: ScheduleRow[], timezone: string, days: number, now: Date, kinds: readonly ScheduleKind[]) {
  const startDate = dateKeyInZone(now, timezone);
  const intervals: Interval[] = [];

  // Start one local day early so an overnight window from yesterday can
  // correctly carry into today.
  for (let offset = -1; offset <= days; offset += 1) {
    const dateKey = addDays(startDate, offset);
    const dow = weekday(dateKey);
    for (const row of rows) {
      if (!row.enabled || !kinds.includes(row.kind) || Number(row.day_of_week) !== dow) continue;
      const startMinute = Number(row.start_minute);
      const endMinute = Number(row.end_minute);
      const start = zonedLocalToUtc(dateKey, startMinute, timezone);
      const endDateKey = endMinute <= startMinute ? addDays(dateKey, 1) : dateKey;
      const normalizedEndMinute = endMinute === 1440 ? 0 : endMinute;
      const normalizedEndDateKey = endMinute === 1440 ? addDays(dateKey, 1) : endDateKey;
      const end = zonedLocalToUtc(normalizedEndDateKey, normalizedEndMinute, timezone);
      if (end <= now) continue;
      intervals.push({ start: start < now ? new Date(now) : start, end });
    }
  }
  return mergeIntervals(intervals);
}

function subtractIntervals(base: Interval[], blockers: Interval[]) {
  if (!blockers.length) return base;
  const result: Interval[] = [];
  for (const source of base) {
    let pieces: Interval[] = [{ start: new Date(source.start), end: new Date(source.end) }];
    for (const blocker of blockers) {
      const next: Interval[] = [];
      for (const piece of pieces) {
        if (blocker.end <= piece.start || blocker.start >= piece.end) {
          next.push(piece);
          continue;
        }
        if (blocker.start > piece.start) next.push({ start: piece.start, end: new Date(blocker.start) });
        if (blocker.end < piece.end) next.push({ start: new Date(blocker.end), end: piece.end });
      }
      pieces = next;
      if (!pieces.length) break;
    }
    result.push(...pieces);
  }
  return mergeIntervals(result);
}

function effectiveFreeIntervals(rows: ScheduleRow[], timezone: string, days: number, now: Date) {
  const free = scheduleIntervals(rows, timezone, days, now, ['free']);
  const blockers = scheduleIntervals(rows, timezone, days, now, ['work', 'sleep', 'busy']);
  return subtractIntervals(free, blockers);
}

function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {
  const result: Array<{ startAt: string; endAt: string; durationMinutes: number }> = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    const left = a[i]!; const right = b[j]!;
    const start = new Date(Math.max(left.start.getTime(), right.start.getTime()));
    const end = new Date(Math.min(left.end.getTime(), right.end.getTime()));
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes >= minMinutes) result.push({ startAt: start.toISOString(), endAt: end.toISOString(), durationMinutes });
    if (left.end <= right.end) i += 1; else j += 1;
  }
  return result.slice(0, 12);
}

export async function registerAvailabilityRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/schedules', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT s.*,u.display_name,u.timezone,cm.participant_color
         FROM user_schedules s JOIN users u ON u.id=s.user_id
         JOIN couple_members cm ON cm.user_id=s.user_id AND cm.couple_id=s.couple_id
         WHERE s.couple_id=$1 ORDER BY s.user_id,s.day_of_week,s.start_minute`, [coupleId]);
      return reply.send({ schedules: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/schedules', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const dayOfWeek = integer(body.dayOfWeek, 'Day', 0, 6);
      const startMinute = integer(body.startMinute, 'Start time', 0, 1439);
      const endMinute = integer(body.endMinute, 'End time', 1, 1440);
      if (endMinute === startMinute) throw new ApiError(400, 'Start and end time cannot be the same.');
      const result = await pool.query(
        `INSERT INTO user_schedules(id,couple_id,user_id,label,kind,day_of_week,start_minute,end_minute,enabled)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [randomUUID(), coupleId, request.userId, requiredText(body.label, 'Label', 120), oneOf(body.kind, ['free','work','sleep','busy'] as const, 'free'), dayOfWeek, startMinute, endMinute, body.enabled !== false],
      );
      broadcast(realtime, coupleId, 'schedules', 'created', result.rows[0].id);
      return reply.code(201).send({ schedule: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/schedules/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query('SELECT * FROM user_schedules WHERE id=$1 AND couple_id=$2 AND user_id=$3', [id, coupleId, request.userId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Schedule window not found.');
      const dayOfWeek = body.dayOfWeek === undefined ? Number(current.day_of_week) : integer(body.dayOfWeek, 'Day', 0, 6);
      const startMinute = body.startMinute === undefined ? Number(current.start_minute) : integer(body.startMinute, 'Start time', 0, 1439);
      const endMinute = body.endMinute === undefined ? Number(current.end_minute) : integer(body.endMinute, 'End time', 1, 1440);
      if (endMinute === startMinute) throw new ApiError(400, 'Start and end time cannot be the same.');
      const result = await pool.query(
        `UPDATE user_schedules SET label=$1,kind=$2,day_of_week=$3,start_minute=$4,end_minute=$5,enabled=$6,updated_at=now()
         WHERE id=$7 AND couple_id=$8 AND user_id=$9 RETURNING *`,
        [body.label === undefined ? current.label : requiredText(body.label, 'Label', 120), body.kind === undefined ? current.kind : oneOf(body.kind, ['free','work','sleep','busy'] as const, current.kind),
          dayOfWeek, startMinute, endMinute, body.enabled === undefined ? current.enabled : body.enabled === true, id, coupleId, request.userId],
      );
      broadcast(realtime, coupleId, 'schedules', 'updated', id);
      return reply.send({ schedule: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/schedules/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM user_schedules WHERE id=$1 AND couple_id=$2 AND user_id=$3 RETURNING id', [id, coupleId, request.userId]);
      if (!result.rowCount) throw new ApiError(404, 'Schedule window not found.');
      broadcast(realtime, coupleId, 'schedules', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/availability/overlaps', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as { days?: string; minMinutes?: string };
      const days = Math.min(30, Math.max(1, Number(query.days) || 14));
      const minMinutes = Math.min(480, Math.max(15, Number(query.minMinutes) || 30));
      const membersResult = await pool.query(
        `SELECT cm.user_id,u.display_name,u.timezone,cm.participant_color FROM couple_members cm JOIN users u ON u.id=cm.user_id WHERE cm.couple_id=$1 ORDER BY cm.joined_at`, [coupleId]);
      if (membersResult.rows.length < 2) return reply.send({ overlaps: [], reason: 'Link your partner to compare free time.' });
      const rowsResult = await pool.query(`SELECT * FROM user_schedules WHERE couple_id=$1 AND enabled=true`, [coupleId]);
      const [first, second] = membersResult.rows;
      const firstRows = rowsResult.rows.filter((row) => String(row.user_id) === String(first.user_id)) as ScheduleRow[];
      const secondRows = rowsResult.rows.filter((row) => String(row.user_id) === String(second.user_id)) as ScheduleRow[];
      if (!firstRows.some((row) => row.kind === 'free') || !secondRows.some((row) => row.kind === 'free')) {
        return reply.send({ overlaps: [], reason: 'Both of you need at least one Free window before Togetherly can find overlap.' });
      }
      const now = new Date();
      const result = overlaps(
        effectiveFreeIntervals(firstRows, String(first.timezone), days, now),
        effectiveFreeIntervals(secondRows, String(second.timezone), days, now),
        minMinutes,
      );
      return reply.send({
        overlaps: result,
        reason: result.length ? undefined : 'No shared free time remains after Work, Sleep and Busy windows are taken into account.',
        members: membersResult.rows,
      });
    } catch (error) { return sendError(reply, error); }
  });
}
