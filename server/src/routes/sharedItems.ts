import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';

type JsonObject = Record<string, unknown>;

async function requireCoupleId(userId: string) {
  const result = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
  const coupleId = result.rows[0]?.couple_id ? String(result.rows[0].couple_id) : null;
  if (!coupleId) throw new ApiError(403, 'This account is not linked to a couple.');
  return coupleId;
}

function scratchpadDrawing(value: unknown) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new ApiError(400, 'Scratchpad drawing is invalid.');
  const raw = value as JsonObject;
  if (raw.version !== 1 || !Array.isArray(raw.strokes) || raw.strokes.length > 120) throw new ApiError(400, 'Scratchpad drawing is invalid.');
  let pointCount = 0;
  const strokes = raw.strokes.map((strokeValue, strokeIndex) => {
    if (!strokeValue || typeof strokeValue !== 'object') throw new ApiError(400, 'Scratchpad stroke is invalid.');
    const stroke = strokeValue as JsonObject;
    if (!Array.isArray(stroke.points) || stroke.points.length < 1 || stroke.points.length > 500) throw new ApiError(400, 'Scratchpad stroke has too many points.');
    pointCount += stroke.points.length;
    if (pointCount > 20_000) throw new ApiError(400, 'Scratchpad drawing is too detailed.');
    const points = stroke.points.map((pointValue) => {
      if (!pointValue || typeof pointValue !== 'object') throw new ApiError(400, 'Scratchpad point is invalid.');
      const point = pointValue as JsonObject;
      const x = Number(point.x); const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 1000) throw new ApiError(400, 'Scratchpad point is outside the canvas.');
      return { x, y };
    });
    const width = Math.max(1, Math.min(30, Number(stroke.width) || 7));
    const userId = typeof stroke.userId === 'string' ? stroke.userId.slice(0, 100) : undefined;
    return { id: typeof stroke.id === 'string' ? stroke.id.slice(0, 80) : `stroke-${strokeIndex}`, userId, points, width };
  });
  return { version: 1, strokes };
}

export async function registerSharedItemRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/shared-items/scratchpad', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT * FROM shared_items
         WHERE couple_id = $1 AND shared_key = 'scratchpad'
         LIMIT 1`,
        [coupleId],
      );
      return reply.send({ item: result.rows[0] ?? null });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.put('/shared-items/scratchpad', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as JsonObject;
      if (typeof body.body !== 'string') throw new ApiError(400, 'Scratchpad body must be text.');
      if (body.body.length > 10_000) throw new ApiError(400, 'Scratchpad is limited to 10,000 characters.');
      const mode = body.mode === 'draw' ? 'draw' : body.mode === 'text' || body.mode == null ? 'text' : null;
      if (!mode) throw new ApiError(400, 'Scratchpad mode is invalid.');
      const drawing = scratchpadDrawing(body.drawing);
      const metadata = { mode, drawing };
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `INSERT INTO shared_items(id, couple_id, creator_id, updated_by, item_type, shared_key, title, body, metadata)
         VALUES($1, $2, $3, $3, 'note', 'scratchpad', 'Shared scratchpad', $4, $5::jsonb)
         ON CONFLICT (couple_id, shared_key) WHERE shared_key IS NOT NULL
         DO UPDATE SET body = EXCLUDED.body, metadata = EXCLUDED.metadata, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING *`,
        [randomUUID(), coupleId, request.userId, body.body, JSON.stringify(metadata)],
      );
      const item = result.rows[0];
      realtime.broadcastCouple(coupleId, { type: 'shared_item.updated', sharedKey: 'scratchpad', itemId: item.id });
      return reply.send({ item });
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
