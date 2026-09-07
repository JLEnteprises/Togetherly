import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from './tokens.js';
import { pool } from '../db/pool.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Authentication required.' });
  }
  try {
    const token = verifyAccessToken(authorization.slice(7));
    const account = await pool.query('SELECT auth_version FROM users WHERE id = $1', [token.sub]);
    if (!account.rows[0] || Number(account.rows[0].auth_version) !== token.v) {
      return reply.code(401).send({ error: 'Your session is no longer valid.' });
    }
    request.userId = token.sub;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid session.';
    return reply.code(401).send({ error: message });
  }
}
