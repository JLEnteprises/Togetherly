import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, dateOnlyOrNull, imageDataOrUrl, notifyPartner, optionalText, requiredText, requireCoupleId, setTags, tagsSql, validateTagIds } from './helpers.js';

function uuidValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, `${label} is invalid.`);
  return value;
}

function photoValues(body: Record<string, unknown>, key = 'photoUrls') {
  if (body[key] === undefined) return undefined;
  if (!Array.isArray(body[key])) throw new ApiError(400, 'Photos are invalid.');
  const values = (body[key] as unknown[]).slice(0, 8).map((value, index) => imageDataOrUrl(value, `Photo ${index + 1}`)).filter((value): value is string => Boolean(value));
  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');
  return values;
}

async function replaceMemoryPhotos(client: PoolClient, memoryId: string, photos: string[]) {
  await client.query('DELETE FROM memory_media WHERE memory_id=$1', [memoryId]);
  for (let index = 0; index < photos.length; index += 1) {
    await client.query(
      `INSERT INTO memory_media(id,memory_id,media_id,media_url,caption,sort_order) VALUES($1,$2,NULL,$3,'',$4)`,
      [randomUUID(), memoryId, photos[index], index],
    );
  }
}

const photosSql = (alias: string) => `CASE WHEN EXISTS (SELECT 1 FROM memory_media mmx WHERE mmx.memory_id=${alias}.id)
  THEN COALESCE((SELECT json_agg(json_build_object('id',mm.id,'media_url',mm.media_url,'caption',mm.caption,'sort_order',mm.sort_order) ORDER BY mm.sort_order,mm.created_at)
    FROM memory_media mm WHERE mm.memory_id=${alias}.id AND mm.media_url IS NOT NULL), '[]'::json)
  WHEN ${alias}.photo_url IS NOT NULL THEN json_build_array(json_build_object('id',NULL,'media_url',${alias}.photo_url,'caption','','sort_order',0))
  ELSE '[]'::json END AS photos`;

export async function registerMemoryRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/memories', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT m.*, ${tagsSql('m', 'memory')}, ${photosSql('m')}
         FROM memories m WHERE m.couple_id=$1 ORDER BY m.memory_date DESC, m.created_at DESC`, [coupleId]);
      return reply.send({ memories: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/memories', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const memoryDate = dateOnlyOrNull(body.memoryDate, 'Memory date');
      if (!memoryDate) throw new ApiError(400, 'Memory date is required.');
      const photos = photoValues(body) ?? (body.photoUrl ? [imageDataOrUrl(body.photoUrl, 'Memory photo')].filter((value): value is string => Boolean(value)) : []);
      const id = randomUUID();
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO memories(id,couple_id,creator_id,title,description,memory_date,location,is_milestone,emoji,photo_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, coupleId, request.userId, requiredText(body.title, 'Memory title', 200), optionalText(body.description, 10000), memoryDate,
          optionalText(body.location, 300), body.isMilestone === true, body.emoji ? requiredText(body.emoji, 'Emoji', 16) : '✦', photos[0] ?? null],
      );
      await replaceMemoryPhotos(client, id, photos);
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'memory', preference: 'notification_memories', entityType: 'memory', entityId: id, title: 'New memory added', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'memories', 'created', id);
      return reply.code(201).send({ memory: { ...result.rows[0], photos: photos.map((media_url, index) => ({ id: null, media_url, caption: '', sort_order: index })) } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.patch('/memories/:id', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Memory');
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      await client.query('BEGIN');
      const currentResult = await client.query('SELECT * FROM memories WHERE id=$1 AND couple_id=$2 FOR UPDATE', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Memory not found.');
      const memoryDate = body.memoryDate === undefined ? current.memory_date : dateOnlyOrNull(body.memoryDate, 'Memory date');
      if (!memoryDate) throw new ApiError(400, 'Memory date is required.');
      const photos = photoValues(body);
      const legacyPhoto = body.photoUrl === undefined ? current.photo_url : imageDataOrUrl(body.photoUrl, 'Memory photo');
      const nextPrimary = photos === undefined ? legacyPhoto : (photos[0] ?? null);
      const result = await client.query(
        `UPDATE memories SET title=$1,description=$2,memory_date=$3,location=$4,is_milestone=$5,emoji=$6,photo_url=$7,updated_at=now()
         WHERE id=$8 AND couple_id=$9 RETURNING *`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Memory title', 200),
          body.description === undefined ? current.description : optionalText(body.description, 10000), memoryDate,
          body.location === undefined ? current.location : optionalText(body.location, 300),
          body.isMilestone === undefined ? current.is_milestone : body.isMilestone === true,
          body.emoji === undefined ? current.emoji : requiredText(body.emoji, 'Emoji', 16), nextPrimary, id, coupleId],
      );
      if (photos !== undefined) await replaceMemoryPhotos(client, id, photos);
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      broadcast(realtime, coupleId, 'memories', 'updated', id);
      return reply.send({ memory: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.delete('/memories/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM memories WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Memory not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='memory' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'memories', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/memory-albums', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT a.*,
          (SELECT COUNT(*)::int FROM memory_album_items mai WHERE mai.album_id=a.id) AS memory_count,
          (SELECT COALESCE(mm.media_url,m.photo_url) FROM memory_album_items mai
             JOIN memories m ON m.id=mai.memory_id
             LEFT JOIN LATERAL (SELECT media_url FROM memory_media WHERE memory_id=m.id AND media_url IS NOT NULL ORDER BY sort_order,created_at LIMIT 1) mm ON true
             WHERE mai.album_id=a.id ORDER BY mai.created_at DESC LIMIT 1) AS cover_url
         FROM memory_albums a WHERE a.couple_id=$1 ORDER BY a.updated_at DESC`, [coupleId]);
      return reply.send({ albums: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/memory-albums', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const result = await pool.query(
        `INSERT INTO memory_albums(id,couple_id,creator_id,title,description) VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [randomUUID(), coupleId, request.userId, requiredText(body.title, 'Album title', 160), optionalText(body.description, 2000)],
      );
      broadcast(realtime, coupleId, 'memories', 'album-created', result.rows[0].id);
      return reply.code(201).send({ album: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/memory-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string }; uuidValue(id, 'Album');
      const body = request.body as Record<string, unknown>;
      const current = await pool.query('SELECT * FROM memory_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!current.rows[0]) throw new ApiError(404, 'Album not found.');
      const result = await pool.query(
        `UPDATE memory_albums SET title=$1,description=$2,updated_at=now() WHERE id=$3 AND couple_id=$4 RETURNING *`,
        [body.title === undefined ? current.rows[0].title : requiredText(body.title, 'Album title', 160), body.description === undefined ? current.rows[0].description : optionalText(body.description, 2000), id, coupleId],
      );
      broadcast(realtime, coupleId, 'memories', 'album-updated', id);
      return reply.send({ album: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/memory-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string }; uuidValue(id, 'Album');
      const albumResult = await pool.query('SELECT * FROM memory_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!albumResult.rows[0]) throw new ApiError(404, 'Album not found.');
      const memories = await pool.query(
        `SELECT m.*, ${tagsSql('m', 'memory')}, ${photosSql('m')}
         FROM memory_album_items mai JOIN memories m ON m.id=mai.memory_id
         WHERE mai.album_id=$1 ORDER BY m.memory_date DESC,m.created_at DESC`, [id]);
      return reply.send({ album: albumResult.rows[0], memories: memories.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/memory-albums/:id/memories', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string }; uuidValue(id, 'Album');
      const body = request.body as Record<string, unknown>; const memoryId = uuidValue(body.memoryId, 'Memory');
      const valid = await pool.query(
        `SELECT a.id FROM memory_albums a JOIN memories m ON m.couple_id=a.couple_id WHERE a.id=$1 AND a.couple_id=$2 AND m.id=$3`, [id, coupleId, memoryId]);
      if (!valid.rowCount) throw new ApiError(404, 'Album or memory not found.');
      await pool.query(`INSERT INTO memory_album_items(album_id,memory_id,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [id, memoryId, request.userId]);
      await pool.query('UPDATE memory_albums SET updated_at=now() WHERE id=$1', [id]);
      broadcast(realtime, coupleId, 'memories', 'album-memory-added', memoryId);
      return reply.code(201).send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/memory-albums/:id/memories/:memoryId', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id, memoryId } = request.params as { id: string; memoryId: string }; uuidValue(id, 'Album'); uuidValue(memoryId, 'Memory');
      const album = await pool.query('SELECT id FROM memory_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!album.rowCount) throw new ApiError(404, 'Album not found.');
      await pool.query('DELETE FROM memory_album_items WHERE album_id=$1 AND memory_id=$2', [id, memoryId]);
      broadcast(realtime, coupleId, 'memories', 'album-memory-removed', memoryId);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/memory-albums/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string }; uuidValue(id, 'Album');
      const result = await pool.query('DELETE FROM memory_albums WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Album not found.');
      broadcast(realtime, coupleId, 'memories', 'album-deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/timeline', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const coupleResult = await pool.query('SELECT relationship_start_date, anniversary_date FROM couples WHERE id=$1', [coupleId]);
      const milestones = await pool.query(
        `SELECT m.*, ${photosSql('m')} FROM memories m WHERE m.couple_id=$1 AND m.is_milestone=true ORDER BY m.memory_date ASC,m.created_at ASC`, [coupleId]);
      return reply.send({ couple: coupleResult.rows[0] ?? null, milestones: milestones.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/memory-jar/random', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(`SELECT m.*, ${photosSql('m')} FROM memories m WHERE m.couple_id=$1 ORDER BY random() LIMIT 1`, [coupleId]);
      return reply.send({ memory: result.rows[0] ?? null });
    } catch (error) { return sendError(reply, error); }
  });
}
