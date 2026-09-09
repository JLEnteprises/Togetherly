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
    const width = Math.max(1, Math.min(48, Number(stroke.width) || 7));
    const userId = typeof stroke.userId === 'string' ? stroke.userId.slice(0, 100) : undefined;
    const color = typeof stroke.color === 'string' && /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color.toLowerCase() : undefined;
    const opacity = Math.max(0.1, Math.min(1, Number(stroke.opacity) || 1));
    const tool = ['pen', 'marker', 'highlighter', 'eraser'].includes(String(stroke.tool)) ? String(stroke.tool) : undefined;
    return { id: typeof stroke.id === 'string' ? stroke.id.slice(0, 80) : `stroke-${strokeIndex}`, userId, points, width, ...(color ? { color } : {}), opacity, ...(tool ? { tool } : {}) };
  });
  return { version: 1, strokes };
}

function expectedVersion(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) throw new ApiError(400, 'Scratchpad version is invalid.');
  return value;
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
    const client = await pool.connect();
    try {
      const body = request.body as JsonObject;
      if (typeof body.body !== 'string') throw new ApiError(400, 'Scratchpad body must be text.');
      if (body.body.length > 10_000) throw new ApiError(400, 'Scratchpad is limited to 10,000 characters.');
      const mode = body.mode === 'draw' ? 'draw' : body.mode === 'text' || body.mode == null ? 'text' : null;
      if (!mode) throw new ApiError(400, 'Scratchpad mode is invalid.');
      const drawing = scratchpadDrawing(body.drawing);
      const metadata = { mode, drawing };
      const expectedUpdatedAt = expectedVersion(body.updatedAt);
      const coupleId = await requireCoupleId(request.userId);

      await client.query('BEGIN');
      const current = await client.query(
        `SELECT * FROM shared_items
         WHERE couple_id = $1 AND shared_key = 'scratchpad'
         LIMIT 1
         FOR UPDATE`,
        [coupleId],
      );

      let item;
      if (current.rows[0]) {
        if (!expectedUpdatedAt) {
          throw new ApiError(409, 'This scratchpad changed after you opened it. Reload before saving so your partner’s changes are not overwritten.');
        }
        const serverVersion = new Date(current.rows[0].updated_at).getTime();
        const clientVersion = new Date(expectedUpdatedAt).getTime();
        if (serverVersion !== clientVersion) {
          throw new ApiError(409, 'This scratchpad changed after you opened it. Your draft is still on this device. Reload the latest version before saving.');
        }

        const updated = await client.query(
          `UPDATE shared_items
           SET body = $1, metadata = $2::jsonb, updated_by = $3, updated_at = now()
           WHERE id = $4 AND couple_id = $5
           RETURNING *`,
          [body.body, JSON.stringify(metadata), request.userId, current.rows[0].id, coupleId],
        );
        item = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO shared_items(id, couple_id, creator_id, updated_by, item_type, shared_key, title, body, metadata)
           VALUES($1, $2, $3, $3, 'note', 'scratchpad', 'Shared scratchpad', $4, $5::jsonb)
           RETURNING *`,
          [randomUUID(), coupleId, request.userId, body.body, JSON.stringify(metadata)],
        );
        item = inserted.rows[0];
      }

      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'shared_item.updated', sharedKey: 'scratchpad', itemId: item.id });
      return reply.send({ item });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally {
      client.release();
    }
  });
}
