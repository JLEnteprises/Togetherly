import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, oneOf, optionalText, requiredText, requireCoupleId } from './helpers.js';


function drawingValue(value: unknown) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new ApiError(400, 'Drawn icon is invalid.');
  const raw = value as { version?: unknown; strokes?: unknown };
  if (raw.version !== 1 || !Array.isArray(raw.strokes) || raw.strokes.length > 32) throw new ApiError(400, 'Drawn icon is invalid.');
  const strokes = raw.strokes.map((stroke, strokeIndex) => {
    if (!stroke || typeof stroke !== 'object') throw new ApiError(400, 'Drawn icon is invalid.');
    const item = stroke as { id?: unknown; points?: unknown; width?: unknown };
    if (!Array.isArray(item.points) || item.points.length < 1 || item.points.length > 500) throw new ApiError(400, 'Drawn icon has too many points.');
    const points = item.points.map((point) => {
      if (!point || typeof point !== 'object') throw new ApiError(400, 'Drawn icon is invalid.');
      const x = Number((point as { x?: unknown }).x);
      const y = Number((point as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 1000) throw new ApiError(400, 'Drawn icon is outside the canvas.');
      return { x, y };
    });
    return { id: typeof item.id === 'string' ? item.id.slice(0, 80) : `stroke-${strokeIndex}`, points, width: Math.max(1, Math.min(30, Number(item.width) || 7)) };
  });
  return { version: 1, strokes };
}

const defaultTags = [
  ['Outdoors', '🌿'], ['Indoors', '⌂'], ['Romantic', '♥'], ['Food', '🍴'], ['Free', '○'], ['Cheap', '$'], ['Moderate', '$$'], ['Expensive', '$$$'],
  ['Adventure', '✦'], ['Relaxing', '☾'], ['Gaming', '🎮'], ['Movies', '🎬'], ['Travel', '✈'], ['Family', '⌂'], ['Kids', '★'], ['Night', '☾'], ['Morning', '☀'], ['Quick', '⚡'], ['All Day', '◷'], ['Important', '!'],
] as const;

export async function registerPreferenceRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/tags', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query('SELECT * FROM tags WHERE couple_id=$1 ORDER BY lower(name)', [coupleId]);
      return reply.send({ tags: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/tags', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const result = await pool.query('INSERT INTO tags(id,couple_id,creator_id,name,icon,icon_drawing) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [randomUUID(), coupleId, request.userId, requiredText(body.name, 'Tag name', 40), body.icon ? requiredText(body.icon, 'Icon', 16) : null, drawingValue(body.iconDrawing)]);
      broadcast(realtime, coupleId, 'tags', 'created', result.rows[0].id);
      return reply.code(201).send({ tag: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return sendError(reply, new ApiError(409, 'That tag already exists.'));
      return sendError(reply, error);
    }
  });

  app.patch('/tags/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query('SELECT * FROM tags WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Tag not found.');
      const name = body.name === undefined ? current.name : requiredText(body.name, 'Tag name', 40);
      const icon = body.icon === undefined ? current.icon : body.icon == null || body.icon === '' ? null : requiredText(body.icon, 'Icon', 16);
      const iconDrawing = body.iconDrawing === undefined ? current.icon_drawing : drawingValue(body.iconDrawing);
      const result = await pool.query('UPDATE tags SET name=$1,icon=$2,icon_drawing=$3 WHERE id=$4 AND couple_id=$5 RETURNING *', [name, icon, iconDrawing, id, coupleId]);
      broadcast(realtime, coupleId, 'tags', 'updated', id);
      return reply.send({ tag: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return sendError(reply, new ApiError(409, 'That tag already exists.'));
      return sendError(reply, error);
    }
  });

  app.post('/tags/bootstrap', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      await client.query('BEGIN');
      for (const [name, icon] of defaultTags) {
        await client.query(`INSERT INTO tags(id,couple_id,creator_id,name,icon) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT DO NOTHING`, [randomUUID(), coupleId, request.userId, name, icon]);
      }
      await client.query('COMMIT');
      const result = await pool.query('SELECT * FROM tags WHERE couple_id=$1 ORDER BY lower(name)', [coupleId]);
      broadcast(realtime, coupleId, 'tags', 'bootstrap');
      return reply.send({ tags: result.rows });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.delete('/tags/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM tags WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Tag not found.');
      broadcast(realtime, coupleId, 'tags', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/preferences', { preHandler: authenticate }, async (request, reply) => {
    try {
      await pool.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING', [request.userId]);
      const result = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [request.userId]);
      return reply.send({ preferences: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/preferences', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      await pool.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING', [request.userId]);
      const currentResult = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [request.userId]);
      const current = currentResult.rows[0];
      const result = await pool.query(
        `UPDATE user_preferences SET reduced_motion=$1,haptics=$2,high_contrast=$3,notification_events=$4,notification_tasks=$5,notification_countdowns=$6,
         notification_partner_activity=$7,notification_daily_question=$8,notification_partner_mood=$9,notification_goal_milestones=$10,
         notification_memories=$11,notification_visit_approaching=$12,notification_relationship_pings=$13,backdrop_theme=$14,updated_at=now() WHERE user_id=$15 RETURNING *`,
        [body.reducedMotion === undefined ? current.reduced_motion : body.reducedMotion === true,
          body.haptics === undefined ? current.haptics : body.haptics === true,
          body.highContrast === undefined ? current.high_contrast : body.highContrast === true,
          body.notificationEvents === undefined ? current.notification_events : body.notificationEvents === true,
          body.notificationTasks === undefined ? current.notification_tasks : body.notificationTasks === true,
          body.notificationCountdowns === undefined ? current.notification_countdowns : body.notificationCountdowns === true,
          body.notificationPartnerActivity === undefined ? current.notification_partner_activity : body.notificationPartnerActivity === true,
          body.notificationDailyQuestion === undefined ? current.notification_daily_question : body.notificationDailyQuestion === true,
          body.notificationPartnerMood === undefined ? current.notification_partner_mood : body.notificationPartnerMood === true,
          body.notificationGoalMilestones === undefined ? current.notification_goal_milestones : body.notificationGoalMilestones === true,
          body.notificationMemories === undefined ? current.notification_memories : body.notificationMemories === true,
          body.notificationVisitApproaching === undefined ? current.notification_visit_approaching : body.notificationVisitApproaching === true,
          body.notificationRelationshipPings === undefined ? current.notification_relationship_pings : body.notificationRelationshipPings === true,
          body.backdropTheme === undefined ? current.backdrop_theme : oneOf(body.backdropTheme, ['dual_orbit','minimal_night','cottagecore','gothic','warm_light'] as const, current.backdrop_theme),
          request.userId],
      );
      return reply.send({ preferences: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/workspace/colors/swap', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      await client.query('BEGIN');
      const members = await client.query('SELECT user_id,participant_color FROM couple_members WHERE couple_id=$1 ORDER BY joined_at ASC FOR UPDATE', [coupleId]);
      if ((members.rowCount ?? 0) !== 2) throw new ApiError(409, 'Both partners must be linked before colours can be swapped.');
      const first = members.rows[0];
      const second = members.rows[1];
      await client.query('UPDATE couple_members SET participant_color=NULL WHERE couple_id=$1', [coupleId]);
      const firstNext = second.participant_color ?? '#B7CB7C';
      const secondNext = first.participant_color ?? '#BE9AFF';
      await client.query('UPDATE couple_members SET participant_color=$1 WHERE couple_id=$2 AND user_id=$3', [firstNext, coupleId, first.user_id]);
      await client.query('UPDATE couple_members SET participant_color=$1 WHERE couple_id=$2 AND user_id=$3', [secondNext, coupleId, second.user_id]);
      await client.query('UPDATE users SET preferred_participant_color=$1,updated_at=now() WHERE id=$2', [firstNext, first.user_id]);
      await client.query('UPDATE users SET preferred_participant_color=$1,updated_at=now() WHERE id=$2', [secondNext, second.user_id]);
      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.get('/search', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as { q?: string };
      const q = requiredText(query.q, 'Search', 100);
      if (q.length < 2) throw new ApiError(400, 'Enter at least two characters.');
      const like = `%${q}%`;
      const result = await pool.query(
        `SELECT * FROM (
          SELECT 'task'::text AS type, t.id, t.title, t.description AS subtitle, t.creator_id, t.updated_at AS sort_at FROM tasks t WHERE t.couple_id=$1 AND (t.title ILIKE $2 OR t.description ILIKE $2)
          UNION ALL
          SELECT 'note', n.id, n.title, left(n.body,200), n.creator_id, n.updated_at FROM notes n WHERE n.couple_id=$1 AND (n.visibility='shared' OR n.creator_id=$3) AND (n.title ILIKE $2 OR n.body ILIKE $2)
          UNION ALL
          SELECT 'list', l.id, l.title, ''::text, l.creator_id, l.updated_at FROM lists l WHERE l.couple_id=$1 AND l.title ILIKE $2
          UNION ALL
          SELECT 'event', e.id, e.title, e.description, e.creator_id, e.updated_at FROM events e WHERE e.couple_id=$1 AND (e.title ILIKE $2 OR e.description ILIKE $2 OR e.location ILIKE $2)
          UNION ALL
          SELECT 'goal', g.id, g.title, g.description, g.creator_id, g.updated_at FROM goals g WHERE g.couple_id=$1 AND (g.title ILIKE $2 OR g.description ILIKE $2)
          UNION ALL
          SELECT 'memory', m.id, m.title, m.description, m.creator_id, m.updated_at FROM memories m WHERE m.couple_id=$1 AND (m.title ILIKE $2 OR m.description ILIKE $2 OR m.location ILIKE $2)
          UNION ALL
          SELECT 'activity', a.id, a.title, a.description, a.creator_id, a.updated_at FROM activities a WHERE a.couple_id=$1 AND (a.title ILIKE $2 OR a.description ILIKE $2 OR a.location ILIKE $2)
          UNION ALL
          SELECT 'trip', tr.id, tr.title, concat_ws(' · ',tr.destination,tr.notes), tr.creator_id, tr.updated_at FROM trips tr WHERE tr.couple_id=$1 AND (tr.title ILIKE $2 OR tr.destination ILIKE $2 OR tr.notes ILIKE $2)
          UNION ALL
          SELECT 'countdown', c.id, c.title, c.type, c.creator_id, c.updated_at FROM countdowns c WHERE c.couple_id=$1 AND c.title ILIKE $2
        ) results ORDER BY sort_at DESC LIMIT 60`, [coupleId, like, request.userId]);
      return reply.send({ results: result.rows });
    } catch (error) { return sendError(reply, error); }
  });
}
