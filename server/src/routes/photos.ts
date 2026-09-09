import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import {
  broadcast,
  dateTimeOrNull,
  imageDataOrUrl,
  optionalText,
  requiredText,
  requireCoupleId,
} from './helpers.js';

function uuidValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }
  return value;
}

async function memoryLinkValue(coupleId: string, value: unknown) {
  if (value == null || value === '') return null;
  const id = uuidValue(value, 'Linked memory');
  const result = await pool.query('SELECT id FROM memories WHERE id=$1 AND couple_id=$2', [id, coupleId]);
  if (!result.rowCount) throw new ApiError(400, 'Linked memory does not belong to this couple.');
  return id;
}

const photoSelect = `
  SELECT p.*,
    m.title AS linked_memory_title,
    m.memory_date AS linked_memory_date
  FROM photos p
  LEFT JOIN memories m ON m.id=p.linked_memory_id
`;

// H1_STANDALONE_PHOTOS_DATA_MODEL: photos are first-class couple content and may optionally link to a Memory.
export async function registerPhotoRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/photos', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `${photoSelect}
         WHERE p.couple_id=$1
         ORDER BY COALESCE(p.taken_at,p.created_at) DESC,p.created_at DESC`,
        [coupleId],
      );
      return reply.send({ photos: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/photos/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Photo');
      const result = await pool.query(
        `${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`,
        [id, coupleId],
      );
      if (!result.rows[0]) throw new ApiError(404, 'Photo not found.');
      return reply.send({ photo: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/photos', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const mediaUrl = imageDataOrUrl(body.mediaUrl, 'Photo');
      if (!mediaUrl) throw new ApiError(400, 'Photo is required.');
      const linkedMemoryId = await memoryLinkValue(coupleId, body.linkedMemoryId);
      const takenAt = dateTimeOrNull(body.takenAt, 'Taken at');
      const id = randomUUID();

      await pool.query(
        `INSERT INTO photos(id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          coupleId,
          request.userId,
          mediaUrl,
          optionalText(body.caption, 2000),
          takenAt,
          linkedMemoryId,
        ],
      );

      const result = await pool.query(`${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`, [id, coupleId]);
      broadcast(realtime, coupleId, 'photos', 'created', id);
      return reply.code(201).send({ photo: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/photos/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Photo');
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query('SELECT * FROM photos WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Photo not found.');

      const mediaUrl = body.mediaUrl === undefined ? current.media_url : imageDataOrUrl(body.mediaUrl, 'Photo');
      if (!mediaUrl) throw new ApiError(400, 'Photo is required.');
      const caption = body.caption === undefined ? current.caption : optionalText(body.caption, 2000);
      const takenAt = body.takenAt === undefined ? current.taken_at : dateTimeOrNull(body.takenAt, 'Taken at');
      const linkedMemoryId = body.linkedMemoryId === undefined
        ? current.linked_memory_id
        : await memoryLinkValue(coupleId, body.linkedMemoryId);

      await pool.query(
        `UPDATE photos
         SET media_url=$1,caption=$2,taken_at=$3,linked_memory_id=$4,updated_at=now()
         WHERE id=$5 AND couple_id=$6`,
        [mediaUrl, caption, takenAt, linkedMemoryId, id, coupleId],
      );

      const result = await pool.query(`${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`, [id, coupleId]);
      broadcast(realtime, coupleId, 'photos', 'updated', id);
      return reply.send({ photo: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/photos/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Photo');
      const result = await pool.query('DELETE FROM photos WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Photo not found.');
      broadcast(realtime, coupleId, 'photos', 'deleted', id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/photo-albums', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT a.*,
          (SELECT COUNT(*)::int FROM photo_album_items pai WHERE pai.album_id=a.id) AS photo_count,
          (SELECT p.media_url
             FROM photo_album_items pai
             JOIN photos p ON p.id=pai.photo_id
             WHERE pai.album_id=a.id
             ORDER BY pai.sort_order,pai.created_at
             LIMIT 1) AS cover_url
         FROM photo_albums a
         WHERE a.couple_id=$1
         ORDER BY a.updated_at DESC,a.created_at DESC`,
        [coupleId],
      );
      return reply.send({ albums: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/photo-albums', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const result = await pool.query(
        `INSERT INTO photo_albums(id,couple_id,creator_id,title,description)
         VALUES($1,$2,$3,$4,$5)
         RETURNING *`,
        [
          randomUUID(),
          coupleId,
          request.userId,
          requiredText(body.title, 'Album title', 160),
          optionalText(body.description, 2000),
        ],
      );
      broadcast(realtime, coupleId, 'photos', 'album-created', result.rows[0].id);
      return reply.code(201).send({ album: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Album');

      const albumResult = await pool.query(
        `SELECT a.*,
          (SELECT COUNT(*)::int FROM photo_album_items pai WHERE pai.album_id=a.id) AS photo_count,
          (SELECT p.media_url
             FROM photo_album_items pai
             JOIN photos p ON p.id=pai.photo_id
             WHERE pai.album_id=a.id
             ORDER BY pai.sort_order,pai.created_at
             LIMIT 1) AS cover_url
         FROM photo_albums a
         WHERE a.id=$1 AND a.couple_id=$2`,
        [id, coupleId],
      );
      if (!albumResult.rows[0]) throw new ApiError(404, 'Album not found.');

      const photosResult = await pool.query(
        `${photoSelect}
         JOIN photo_album_items pai ON pai.photo_id=p.id
         WHERE pai.album_id=$1 AND p.couple_id=$2
         ORDER BY pai.sort_order,COALESCE(p.taken_at,p.created_at) DESC,p.created_at DESC`,
        [id, coupleId],
      );
      return reply.send({ album: albumResult.rows[0], photos: photosResult.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Album');
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query('SELECT * FROM photo_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Album not found.');

      const result = await pool.query(
        `UPDATE photo_albums
         SET title=$1,description=$2,updated_at=now()
         WHERE id=$3 AND couple_id=$4
         RETURNING *`,
        [
          body.title === undefined ? current.title : requiredText(body.title, 'Album title', 160),
          body.description === undefined ? current.description : optionalText(body.description, 2000),
          id,
          coupleId,
        ],
      );
      broadcast(realtime, coupleId, 'photos', 'album-updated', id);
      return reply.send({ album: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/photo-albums/:id/photos', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Album');
      const body = request.body as Record<string, unknown>;
      const photoId = uuidValue(body.photoId, 'Photo');

      const valid = await pool.query(
        `SELECT 1
         FROM photo_albums a
         JOIN photos p ON p.couple_id=a.couple_id
         WHERE a.id=$1 AND a.couple_id=$2 AND p.id=$3`,
        [id, coupleId, photoId],
      );
      if (!valid.rowCount) throw new ApiError(404, 'Album or photo not found.');

      const orderResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order),-1)+1 AS next_order FROM photo_album_items WHERE album_id=$1',
        [id],
      );
      const nextOrder = Number(orderResult.rows[0]?.next_order ?? 0);

      await pool.query(
        `INSERT INTO photo_album_items(album_id,photo_id,added_by,sort_order)
         VALUES($1,$2,$3,$4)
         ON CONFLICT (album_id,photo_id) DO NOTHING`,
        [id, photoId, request.userId, nextOrder],
      );
      await pool.query('UPDATE photo_albums SET updated_at=now() WHERE id=$1', [id]);
      broadcast(realtime, coupleId, 'photos', 'album-photo-added', photoId);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/photo-albums/:id/photos/:photoId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id, photoId } = request.params as { id: string; photoId: string };
      uuidValue(id, 'Album');
      uuidValue(photoId, 'Photo');

      const albumResult = await pool.query('SELECT id FROM photo_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!albumResult.rowCount) throw new ApiError(404, 'Album not found.');

      await pool.query('DELETE FROM photo_album_items WHERE album_id=$1 AND photo_id=$2', [id, photoId]);
      await pool.query('UPDATE photo_albums SET updated_at=now() WHERE id=$1', [id]);
      broadcast(realtime, coupleId, 'photos', 'album-photo-removed', photoId);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Album');
      const result = await pool.query('DELETE FROM photo_albums WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Album not found.');
      broadcast(realtime, coupleId, 'photos', 'album-deleted', id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
