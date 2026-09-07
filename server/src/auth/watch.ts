import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db/pool.js';

function hashWatchToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createWatchSession(userId: string, deviceName = 'Apple Watch') {
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 86_400_000);
  await pool.query(
    `INSERT INTO watch_sessions(id,user_id,token_hash,device_name,expires_at)
     VALUES($1,$2,$3,$4,$5)`,
    [id, userId, hashWatchToken(token), deviceName.slice(0, 120), expiresAt.toISOString()],
  );
  return { id, token, expiresAt: expiresAt.toISOString(), deviceName: deviceName.slice(0, 120) };
}

export async function revokeWatchSessions(userId: string) {
  await pool.query('UPDATE watch_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
}

export async function authenticateWatch(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Watch ')) return reply.code(401).send({ error: 'Watch authentication required.' });
  const token = authorization.slice(6).trim();
  if (!token) return reply.code(401).send({ error: 'Watch authentication required.' });
  const result = await pool.query(
    `UPDATE watch_sessions ws SET last_used_at=now()
     FROM users u
     WHERE ws.user_id=u.id AND ws.token_hash=$1 AND ws.revoked_at IS NULL AND ws.expires_at > now() AND u.deleted_at IS NULL
     RETURNING ws.user_id`,
    [hashWatchToken(token)],
  );
  const userId = result.rows[0]?.user_id ? String(result.rows[0].user_id) : null;
  if (!userId) return reply.code(401).send({ error: 'This Apple Watch session is no longer valid.' });
  request.userId = userId;
}
