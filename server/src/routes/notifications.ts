import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { requireCoupleId } from './helpers.js';
import { runReminderSweepForUser } from '../reminders/scheduler.js';

export async function registerNotificationRoutes(app: FastifyInstance) {
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
