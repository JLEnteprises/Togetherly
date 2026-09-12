import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import { requestTransaction } from '../db/requestTransaction.js';

export async function registerOfflineRoutes(app: FastifyInstance) {
  app.get('/sync/capabilities', { preHandler: authenticate }, async () => ({ version: 1 }));
  app.post('/sync/mutation', { preHandler: authenticate }, async (request, reply) => {
    const input = request.body as { id?: string; coupleId?: string; method?: string; path?: string; body?: unknown };
    if (!input || typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(input.id) ||
        typeof input.coupleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.coupleId) ||
        !['POST', 'PATCH', 'DELETE'].includes(input.method ?? '') ||
        !/^\/(tasks(?:\/[0-9a-f-]{36}(?:\/subtasks)?)?|task-subtasks\/[0-9a-f-]{36}|notes(?:\/[0-9a-f-]{36})?|moods)$/.test(input.path ?? '')) {
      return reply.code(400).send({ error: 'Unsupported offline operation.' });
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([input.coupleId, input.method, input.path, input.body])).digest('hex');
    const client = await pool.connect();
    const effects: Array<() => void> = [];
    try {
      await client.query('BEGIN');
      // Serialise a user's replay stream, including a duplicate from another request.
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [request.userId]);
      const membership = await client.query('SELECT 1 FROM couple_members WHERE user_id=$1 AND couple_id=$2 FOR SHARE', [request.userId, input.coupleId]);
      if (!membership.rowCount) { await client.query('ROLLBACK'); return reply.code(403).send({ error: 'This saved change belongs to a different couple space.' }); }
      const previous = await client.query('SELECT fingerprint,response FROM offline_receipts WHERE user_id=$1 AND operation_id=$2', [request.userId, input.id]);
      if (previous.rows[0]) {
        await client.query('ROLLBACK');
        if (previous.rows[0].fingerprint !== fingerprint) return reply.code(409).send({ error: 'This saved operation has changed since it was sent.' });
        return reply.send(previous.rows[0].response);
      }
      if (['PATCH', 'DELETE'].includes(input.method!)) {
        const parts = input.path!.split('/');
        const body = input.body as { updatedAt?: string } | undefined;
        const query = parts[1] === 'task-subtasks'
          ? 'SELECT st.updated_at FROM task_subtasks st JOIN tasks t ON t.id=st.task_id WHERE st.id=$1 AND t.couple_id=$2 FOR UPDATE OF st'
          : parts[1] === 'tasks' ? 'SELECT updated_at FROM tasks WHERE id=$1 AND couple_id=$2 FOR UPDATE'
          : 'SELECT updated_at FROM notes WHERE id=$1 AND couple_id=$2 FOR UPDATE';
        const current = await client.query(query, [parts[2], input.coupleId]);
        if (current.rows[0] && (!body?.updatedAt || Date.parse(body.updatedAt) !== new Date(current.rows[0].updated_at).getTime())) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'This item changed since it was saved on your device. Review your pending change and the latest item before applying it again.' });
        }
      }
      const result = await requestTransaction.run({ client, effects }, () => app.inject({
        method: input.method as 'POST' | 'PATCH' | 'DELETE', url: input.path!, payload: input.body as object,
        headers: { authorization: request.headers.authorization!, 'x-forwarded-proto': request.protocol },
      }));
      const body = result.statusCode === 204 ? null : JSON.parse(result.body);
      if (result.statusCode >= 400) { await client.query('ROLLBACK'); return reply.code(result.statusCode).send(body); }
      if (body?.task?.id) {
        const steps = await client.query('SELECT * FROM task_subtasks WHERE task_id=$1 ORDER BY sort_order,created_at', [body.task.id]);
        body.task.subtasks = steps.rows;
      }
      const receipt = { result: body };
      await client.query('INSERT INTO offline_receipts(user_id,operation_id,couple_id,fingerprint,response) VALUES($1,$2,$3,$4,$5)', [request.userId, input.id, input.coupleId, fingerprint, JSON.stringify(receipt)]);
      await client.query('COMMIT');
      for (const effect of effects) { try { effect(); } catch (error) { request.log.error(error); } }
      return reply.send(receipt);
    } catch (error) {
      await client.query('ROLLBACK');
      request.log.error(error);
      return reply.code(500).send({ error: 'Could not sync this saved change. It is safe to retry.' });
    } finally { client.release(); }
  });
}
