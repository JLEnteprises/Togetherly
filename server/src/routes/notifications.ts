import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { requireCoupleId } from './helpers.js';
import { runReminderSweepForUser } from '../reminders/scheduler.js';
import { randomUUID } from 'node:crypto';
import { sendPushForNotification } from '../push/expo.js';

export async function registerNotificationRoutes(app: FastifyInstance) {

  app.get('/notifications/push/devices', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await pool.query(
        `SELECT id,platform,device_name,active,last_seen_at,created_at FROM device_push_tokens
         WHERE user_id=$1 ORDER BY last_seen_at DESC`, [request.userId],
      );
      return reply.send({ devices: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/notifications/push/register', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;
      const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 120) : '';
      if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) throw new ApiError(400, 'Push token is invalid.');
      if (!platform) throw new ApiError(400, 'Push platform is invalid.');
      const result = await pool.query(
        `INSERT INTO device_push_tokens(id,user_id,token,provider,platform,device_name,active,last_seen_at,updated_at)
         VALUES($1,$2,$3,'expo',$4,$5,true,now(),now())
         ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,device_name=EXCLUDED.device_name,active=true,last_seen_at=now(),updated_at=now()
         RETURNING id,platform,device_name,active,last_seen_at,created_at`,
        [randomUUID(), request.userId, token, platform, deviceName],
      );
      return reply.send({ device: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/notifications/push/token', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (!token) throw new ApiError(400, 'Push token is required.');
      await pool.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1 AND token=$2', [request.userId, token]);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/notifications/push/test', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await sendPushForNotification({
        id: randomUUID(), recipient_user_id: request.userId, kind: 'partner_activity', entity_type: null, entity_id: null,
        title: 'Togetherly is connected', body: 'Push notifications are ready on this device.',
      });
      return reply.send({ ok: true, ...result });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/notifications/reminders/refresh', { preHandler: authenticate }, async (request, reply) => {
    try {
      await requireCoupleId(request.userId);
      await runReminderSweepForUser(request.userId);
      return reply.send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/notifications', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as { unreadOnly?: string; limit?: string };
      const unreadOnly = query.unreadOnly === 'true';
      const requestedLimit = Number(query.limit ?? 50);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 50;
      const result = await pool.query(
        `SELECT n.*, u.display_name AS actor_name
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_user_id
         WHERE n.couple_id=$1 AND n.recipient_user_id=$2
           AND ($3::boolean=false OR n.read_at IS NULL)
         ORDER BY n.created_at DESC
         LIMIT $4`,
        [coupleId, request.userId, unreadOnly, limit],
      );
      const unread = await pool.query(
        'SELECT count(*)::int AS count FROM notifications WHERE couple_id=$1 AND recipient_user_id=$2 AND read_at IS NULL',
        [coupleId, request.userId],
      );
      return reply.send({ notifications: result.rows, unreadCount: Number(unread.rows[0]?.count ?? 0) });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/notifications/:id/read', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query(
        `UPDATE notifications SET read_at=COALESCE(read_at,now())
         WHERE id=$1 AND couple_id=$2 AND recipient_user_id=$3 RETURNING *`,
        [id, coupleId, request.userId],
      );
      if (!result.rowCount) throw new ApiError(404, 'Notification not found.');
      return reply.send({ notification: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/notifications/read-all', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      await pool.query(
        'UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE couple_id=$1 AND recipient_user_id=$2 AND read_at IS NULL',
        [coupleId, request.userId],
      );
      return reply.send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/notifications/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query(
        'DELETE FROM notifications WHERE id=$1 AND couple_id=$2 AND recipient_user_id=$3 RETURNING id',
        [id, coupleId, request.userId],
      );
      if (!result.rowCount) throw new ApiError(404, 'Notification not found.');
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });
}
