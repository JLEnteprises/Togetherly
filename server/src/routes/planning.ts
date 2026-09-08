import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import {
  broadcast,
  dateOnlyOrNull,
  dateTimeOrNull,
  numberOrNull,
  notifyPartner,
  oneOf,
  optionalText,
  requiredText,
  requireCoupleId,
  resolvePersonTarget,
  setTags,
  tagsSql,
  validateTagIds,
} from './helpers.js';


type TripLinkType = 'list' | 'goal' | 'countdown' | 'event';
const tripLinkTables: Record<TripLinkType, string> = { list: 'lists', goal: 'goals', countdown: 'countdowns', event: 'events' };
function tripLinkType(value: unknown): TripLinkType {
  if (typeof value !== 'string' || !Object.hasOwn(tripLinkTables, value)) throw new ApiError(400, 'That trip link type is not supported.');
  return value as TripLinkType;
}
function uuidValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, `${label} is invalid.`);
  return value;
}
async function requireTrip(coupleId: string, id: string) {
  const result = await pool.query(`SELECT tr.*, ${tagsSql('tr', 'trip')} FROM trips tr WHERE tr.id=$1 AND tr.couple_id=$2`, [id, coupleId]);
  if (!result.rows[0]) throw new ApiError(404, 'Trip not found.');
  return result.rows[0];
}
async function validateTripEntity(coupleId: string, type: TripLinkType, id: string) {
  const table = tripLinkTables[type];
  const result = await pool.query(`SELECT id,title FROM ${table} WHERE id=$1 AND couple_id=$2`, [id, coupleId]);
  if (!result.rows[0]) throw new ApiError(404, 'That item could not be found in this couple space.');
  return result.rows[0];
}
async function tripLinks(tripId: string) {
  const result = await pool.query(
    `SELECT tl.entity_type, tl.entity_id, tl.created_by, tl.created_at,
      COALESCE(l.title, g.title, c.title, e.title) AS title,
      CASE
        WHEN tl.entity_type='list' THEN CONCAT(COALESCE((SELECT COUNT(*) FROM list_items li WHERE li.list_id=l.id),0), ' items')
        WHEN tl.entity_type='goal' THEN CONCAT(g.current_value, ' / ', g.target_value, CASE WHEN g.unit<>'' THEN ' ' || g.unit ELSE '' END)
        WHEN tl.entity_type='countdown' THEN c.target_at::text
        WHEN tl.entity_type='event' THEN e.start_at::text
        ELSE ''
      END AS subtitle
     FROM trip_links tl
     LEFT JOIN lists l ON tl.entity_type='list' AND l.id=tl.entity_id
     LEFT JOIN goals g ON tl.entity_type='goal' AND g.id=tl.entity_id
     LEFT JOIN countdowns c ON tl.entity_type='countdown' AND c.id=tl.entity_id
     LEFT JOIN events e ON tl.entity_type='event' AND e.id=tl.entity_id
     WHERE tl.trip_id=$1 AND COALESCE(l.id,g.id,c.id,e.id) IS NOT NULL
     ORDER BY tl.created_at ASC`, [tripId]);
  return result.rows;
}

export async function registerPlanningRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/events', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as { from?: string; to?: string };
      const from = dateTimeOrNull(query.from, 'From date');
      const to = dateTimeOrNull(query.to, 'To date');
      const result = await pool.query(
        `SELECT e.*, u.display_name AS assigned_user_name, ${tagsSql('e', 'event')}
         FROM events e LEFT JOIN users u ON u.id = e.assigned_user_id
         WHERE e.couple_id = $1
           AND ($2::timestamptz IS NULL OR COALESCE(e.end_at, e.start_at) >= $2)
           AND ($3::timestamptz IS NULL OR e.start_at <= $3)
         ORDER BY e.start_at ASC`,
        [coupleId, from, to],
      );
      return reply.send({ events: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/events', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const title = requiredText(body.title, 'Event title', 200);
      const startAt = dateTimeOrNull(body.startAt, 'Start');
      if (!startAt) throw new ApiError(400, 'Start is required.');
      const endAt = dateTimeOrNull(body.endAt, 'End');
      if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) throw new ApiError(400, 'End cannot be before start.');
      const allDay = body.allDay === true;
      const startDate = allDay ? (dateOnlyOrNull(body.startDate, 'Start date') ?? new Date(startAt).toISOString().slice(0, 10)) : null;
      const endDate = allDay ? (body.endDate === undefined ? (endAt ? new Date(endAt).toISOString().slice(0, 10) : null) : dateOnlyOrNull(body.endDate, 'End date')) : null;
      if (startDate && endDate && endDate < startDate) throw new ApiError(400, 'End date cannot be before start date.');
      const target = await resolvePersonTarget(coupleId, request.userId, body.assignee);
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO events(id, couple_id, creator_id, assigned_user_id, assign_to_both, title, description, start_at, end_at, start_date, end_date, all_day, location, recurrence)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [id, coupleId, request.userId, target.userId, target.both, title, optionalText(body.description, 5000), startAt, endAt, startDate, endDate, allDay, optionalText(body.location, 300), oneOf(body.recurrence, ['none','daily','weekly','monthly','yearly'] as const, 'none')],
      );
      await setTags(coupleId, 'event', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'event', preference: 'notification_events', entityType: 'event', entityId: id, title: 'New shared event', body: title });
      broadcast(realtime, coupleId, 'events', 'created', id);
      return reply.code(201).send({ event: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/events/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const currentResult = await pool.query('SELECT * FROM events WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Event not found.');
      const title = body.title === undefined ? current.title : requiredText(body.title, 'Event title', 200);
      const startAt = body.startAt === undefined ? current.start_at : dateTimeOrNull(body.startAt, 'Start');
      if (!startAt) throw new ApiError(400, 'Start is required.');
      const endAt = body.endAt === undefined ? current.end_at : dateTimeOrNull(body.endAt, 'End');
      if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) throw new ApiError(400, 'End cannot be before start.');
      const allDay = body.allDay === undefined ? current.all_day === true : body.allDay === true;
      const startDate = allDay
        ? (body.startDate === undefined ? (current.start_date ?? new Date(startAt).toISOString().slice(0, 10)) : dateOnlyOrNull(body.startDate, 'Start date'))
        : null;
      const endDate = allDay
        ? (body.endDate === undefined ? (current.end_date ?? (endAt ? new Date(endAt).toISOString().slice(0, 10) : null)) : dateOnlyOrNull(body.endDate, 'End date'))
        : null;
      if (!startDate && allDay) throw new ApiError(400, 'Start date is required for an all-day event.');
      if (startDate && endDate && endDate < startDate) throw new ApiError(400, 'End date cannot be before start date.');
      let assignedUserId = current.assigned_user_id;
      let assignToBoth = current.assign_to_both;
      if (body.assignee !== undefined) {
        const target = await resolvePersonTarget(coupleId, request.userId, body.assignee);
        assignedUserId = target.userId;
        assignToBoth = target.both;
      }
      const result = await pool.query(
        `UPDATE events SET assigned_user_id=$1, assign_to_both=$2, title=$3, description=$4, start_at=$5, end_at=$6,
          start_date=$7, end_date=$8, all_day=$9, location=$10, recurrence=$11, updated_at=now()
         WHERE id=$12 AND couple_id=$13 RETURNING *`,
        [assignedUserId, assignToBoth, title, body.description === undefined ? current.description : optionalText(body.description, 5000), startAt, endAt,
          startDate, endDate, allDay,
          body.location === undefined ? current.location : optionalText(body.location, 300),
          body.recurrence === undefined ? current.recurrence : oneOf(body.recurrence, ['none','daily','weekly','monthly','yearly'] as const, current.recurrence), id, coupleId],
      );
      await setTags(coupleId, 'event', id, body.tagIds);
      broadcast(realtime, coupleId, 'events', 'updated', id);
      return reply.send({ event: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/events/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM events WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Event not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='event' AND entity_id=$1", [id]);
      await pool.query("DELETE FROM trip_links WHERE entity_type='event' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'events', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/goals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT g.*, ${tagsSql('g', 'goal')},
          COALESCE((SELECT json_agg(json_build_object('id', gc.id, 'creator_id', gc.creator_id, 'amount', gc.amount, 'note', gc.note, 'created_at', gc.created_at) ORDER BY gc.created_at DESC)
            FROM goal_contributions gc WHERE gc.goal_id=g.id), '[]'::json) AS contributions
         FROM goals g WHERE g.couple_id=$1
         ORDER BY (g.status='completed') ASC, g.deadline ASC NULLS LAST, g.updated_at DESC`, [coupleId]);
      return reply.send({ goals: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/goals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const targetValue = numberOrNull(body.targetValue, 'Target', 0.01);
      if (targetValue == null) throw new ApiError(400, 'Target is required.');
      const currentValue = numberOrNull(body.currentValue, 'Current value', 0) ?? 0;
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO goals(id,couple_id,creator_id,title,description,current_value,target_value,unit,deadline,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, coupleId, request.userId, requiredText(body.title, 'Goal title', 160), optionalText(body.description, 5000), currentValue, targetValue,
          optionalText(body.unit, 30), dateOnlyOrNull(body.deadline, 'Deadline'), currentValue >= targetValue ? 'completed' : 'active'],
      );
      await setTags(coupleId, 'goal', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'goal', entityId: id, title: 'New shared goal', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'goals', 'created', id);
      return reply.code(201).send({ goal: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/goals/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const currentResult = await pool.query('SELECT * FROM goals WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Goal not found.');
      const targetValue = body.targetValue === undefined ? Number(current.target_value) : numberOrNull(body.targetValue, 'Target', 0.01);
      if (targetValue == null) throw new ApiError(400, 'Target is required.');
      const currentValue = body.currentValue === undefined ? Number(current.current_value) : (numberOrNull(body.currentValue, 'Current value', 0) ?? 0);
      const requestedStatus = body.status === undefined ? current.status : oneOf(body.status, ['active','paused','completed'] as const, current.status);
      const status = currentValue >= targetValue && requestedStatus !== 'paused' ? 'completed' : requestedStatus;
      const result = await pool.query(
        `UPDATE goals SET title=$1,description=$2,current_value=$3,target_value=$4,unit=$5,deadline=$6,status=$7,updated_at=now()
         WHERE id=$8 AND couple_id=$9 RETURNING *`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Goal title', 160),
          body.description === undefined ? current.description : optionalText(body.description, 5000), currentValue, targetValue,
          body.unit === undefined ? current.unit : optionalText(body.unit, 30), body.deadline === undefined ? current.deadline : dateOnlyOrNull(body.deadline, 'Deadline'), status, id, coupleId],
      );
      await setTags(coupleId, 'goal', id, body.tagIds);
      broadcast(realtime, coupleId, 'goals', 'updated', id);
      return reply.send({ goal: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/goals/:id/contributions', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const amount = numberOrNull(body.amount, 'Amount');
      if (amount == null || amount === 0) throw new ApiError(400, 'Contribution amount cannot be zero.');
      await client.query('BEGIN');
      const goalResult = await client.query('SELECT * FROM goals WHERE id=$1 AND couple_id=$2 FOR UPDATE', [id, coupleId]);
      const goal = goalResult.rows[0];
      if (!goal) throw new ApiError(404, 'Goal not found.');
      const contributionId = randomUUID();
      const currentValue = Number(goal.current_value);
      const effectiveAmount = amount < 0 ? Math.max(amount, -currentValue) : amount;
      if (effectiveAmount === 0) throw new ApiError(400, 'This goal is already at zero.');
      await client.query('INSERT INTO goal_contributions(id,goal_id,creator_id,amount,note) VALUES($1,$2,$3,$4,$5)',
        [contributionId, id, request.userId, effectiveAmount, optionalText(body.note, 500)]);
      const nextValue = currentValue + effectiveAmount;
      const status = nextValue >= Number(goal.target_value) ? 'completed' : (goal.status === 'completed' ? 'active' : goal.status);
      const updated = await client.query('UPDATE goals SET current_value=$1,status=$2,updated_at=now() WHERE id=$3 RETURNING *', [nextValue, status, id]);
      await client.query('COMMIT');
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'goal', preference: 'notification_goal_milestones', entityType: 'goal', entityId: id, title: status === 'completed' ? 'Goal reached' : 'Goal updated', body: String(goal.title) });
      broadcast(realtime, coupleId, 'goals', 'contribution', id);
      return reply.code(201).send({ goal: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.delete('/goals/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM goals WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Goal not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='goal' AND entity_id=$1", [id]);
      await pool.query("DELETE FROM trip_links WHERE entity_type='goal' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'goals', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/trips', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(`SELECT tr.*, ${tagsSql('tr', 'trip')}, (SELECT COUNT(*)::int FROM trip_links tl WHERE tl.trip_id=tr.id) AS link_count FROM trips tr WHERE tr.couple_id=$1 ORDER BY tr.start_date ASC NULLS LAST, tr.created_at DESC`, [coupleId]);
      return reply.send({ trips: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/trips/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const trip = await requireTrip(coupleId, uuidValue(id, 'Trip'));
      return reply.send({ trip, links: await tripLinks(id) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/trips/:id/links', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Trip');
      await requireTrip(coupleId, id);
      const body = request.body as Record<string, unknown>;
      const entityType = tripLinkType(body.entityType);
      const entityId = uuidValue(body.entityId, 'Linked item');
      const entity = await validateTripEntity(coupleId, entityType, entityId);
      await pool.query(
        `INSERT INTO trip_links(trip_id,entity_type,entity_id,created_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [id, entityType, entityId, request.userId],
      );
      broadcast(realtime, coupleId, 'trips', 'linked', id);
      return reply.code(201).send({ link: { entity_type: entityType, entity_id: entityId, title: entity.title } });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/trips/:id/links/:entityType/:entityId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id, entityType: rawType, entityId: rawId } = request.params as { id: string; entityType: string; entityId: string };
      uuidValue(id, 'Trip'); const entityType = tripLinkType(rawType); const entityId = uuidValue(rawId, 'Linked item');
      await requireTrip(coupleId, id);
      await pool.query('DELETE FROM trip_links WHERE trip_id=$1 AND entity_type=$2 AND entity_id=$3', [id, entityType, entityId]);
      broadcast(realtime, coupleId, 'trips', 'unlinked', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/trips', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const startDate = dateOnlyOrNull(body.startDate, 'Start date');
      const endDate = dateOnlyOrNull(body.endDate, 'End date');
      if (startDate && endDate && endDate < startDate) throw new ApiError(400, 'Trip end date cannot be before the start date.');
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO trips(id,couple_id,creator_id,title,destination,start_date,end_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, coupleId, request.userId, requiredText(body.title, 'Trip title', 160), optionalText(body.destination, 250), startDate, endDate, optionalText(body.notes, 5000)],
      );
      await setTags(coupleId, 'trip', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'trip', entityId: id, title: 'New shared trip', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'trips', 'created', id);
      return reply.code(201).send({ trip: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/trips/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const currentResult = await pool.query('SELECT * FROM trips WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Trip not found.');
      const startDate = body.startDate === undefined ? current.start_date : dateOnlyOrNull(body.startDate, 'Start date');
      const endDate = body.endDate === undefined ? current.end_date : dateOnlyOrNull(body.endDate, 'End date');
      if (startDate && endDate && String(endDate) < String(startDate)) throw new ApiError(400, 'Trip end date cannot be before the start date.');
      const result = await pool.query(
        `UPDATE trips SET title=$1,destination=$2,start_date=$3,end_date=$4,notes=$5,updated_at=now() WHERE id=$6 AND couple_id=$7 RETURNING *`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Trip title', 160), body.destination === undefined ? current.destination : optionalText(body.destination, 250),
          startDate, endDate, body.notes === undefined ? current.notes : optionalText(body.notes, 5000), id, coupleId],
      );
      await setTags(coupleId, 'trip', id, body.tagIds);
      broadcast(realtime, coupleId, 'trips', 'updated', id);
      return reply.send({ trip: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/trips/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM trips WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Trip not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='trip' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'trips', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });
}
