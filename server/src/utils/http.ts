import type { FastifyReply } from 'fastify';

export class ApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

type PostgresLikeError = { code?: string; constraint?: string; detail?: string };

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  const databaseError = error as PostgresLikeError | null;
  if (databaseError?.code === '22P02') {
    return reply.code(400).send({ error: 'One of the supplied identifiers or values is invalid.' });
  }
  if (databaseError?.code === '23503' || databaseError?.code === '23514') {
    return reply.code(400).send({ error: 'That change conflicts with the current workspace data.' });
  }
  if (databaseError?.code === '23505') {
    return reply.code(409).send({ error: 'That value already exists.' });
  }

  console.error(error);
  return reply.code(500).send({ error: 'Something went wrong on the server.' });
}
