const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'H1 — Standalone Photos Backend / Data Model';
const MARKER = 'H1_STANDALONE_PHOTOS_DATA_MODEL';
const root = process.cwd();

const migrationSource = "-- H1_STANDALONE_PHOTOS_DATA_MODEL\n-- First-class photos and photo-based albums.\n-- Existing memory_media / memory_albums remain untouched until H3 compatibility work.\n\nCREATE TABLE IF NOT EXISTS photos (\n  id uuid PRIMARY KEY,\n  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,\n  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\n  media_url text NOT NULL CHECK (char_length(media_url) BETWEEN 1 AND 8000000),\n  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 2000),\n  taken_at timestamptz,\n  linked_memory_id uuid REFERENCES memories(id) ON DELETE SET NULL,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS photos_couple_date_idx\n  ON photos(couple_id, taken_at DESC NULLS LAST, created_at DESC);\nCREATE INDEX IF NOT EXISTS photos_linked_memory_idx\n  ON photos(linked_memory_id) WHERE linked_memory_id IS NOT NULL;\n\nCREATE TABLE IF NOT EXISTS photo_albums (\n  id uuid PRIMARY KEY,\n  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,\n  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\n  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),\n  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS photo_albums_couple_idx\n  ON photo_albums(couple_id, updated_at DESC);\n\nCREATE TABLE IF NOT EXISTS photo_album_items (\n  album_id uuid NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,\n  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,\n  added_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\n  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),\n  created_at timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (album_id, photo_id)\n);\n\nCREATE INDEX IF NOT EXISTS photo_album_items_photo_idx\n  ON photo_album_items(photo_id);\nCREATE INDEX IF NOT EXISTS photo_album_items_album_order_idx\n  ON photo_album_items(album_id, sort_order, created_at);\n";
const photoRoutesSource = "import { randomUUID } from 'node:crypto';\nimport type { FastifyInstance } from 'fastify';\nimport type { RealtimeHub } from '../realtime/hub.js';\nimport { pool } from '../db/pool.js';\nimport { authenticate } from '../auth/middleware.js';\nimport { ApiError, sendError } from '../utils/http.js';\nimport {\n  broadcast,\n  dateTimeOrNull,\n  imageDataOrUrl,\n  optionalText,\n  requiredText,\n  requireCoupleId,\n} from './helpers.js';\n\nfunction uuidValue(value: unknown, label: string) {\n  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {\n    throw new ApiError(400, `${label} is invalid.`);\n  }\n  return value;\n}\n\nasync function memoryLinkValue(coupleId: string, value: unknown) {\n  if (value == null || value === '') return null;\n  const id = uuidValue(value, 'Linked memory');\n  const result = await pool.query('SELECT id FROM memories WHERE id=$1 AND couple_id=$2', [id, coupleId]);\n  if (!result.rowCount) throw new ApiError(400, 'Linked memory does not belong to this couple.');\n  return id;\n}\n\nconst photoSelect = `\n  SELECT p.*,\n    m.title AS linked_memory_title,\n    m.memory_date AS linked_memory_date\n  FROM photos p\n  LEFT JOIN memories m ON m.id=p.linked_memory_id\n`;\n\n// H1_STANDALONE_PHOTOS_DATA_MODEL: photos are first-class couple content and may optionally link to a Memory.\nexport async function registerPhotoRoutes(app: FastifyInstance, realtime: RealtimeHub) {\n  app.get('/photos', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const result = await pool.query(\n        `${photoSelect}\n         WHERE p.couple_id=$1\n         ORDER BY COALESCE(p.taken_at,p.created_at) DESC,p.created_at DESC`,\n        [coupleId],\n      );\n      return reply.send({ photos: result.rows });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.get('/photos/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Photo');\n      const result = await pool.query(\n        `${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`,\n        [id, coupleId],\n      );\n      if (!result.rows[0]) throw new ApiError(404, 'Photo not found.');\n      return reply.send({ photo: result.rows[0] });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.post('/photos', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const body = request.body as Record<string, unknown>;\n      const mediaUrl = imageDataOrUrl(body.mediaUrl, 'Photo');\n      if (!mediaUrl) throw new ApiError(400, 'Photo is required.');\n      const linkedMemoryId = await memoryLinkValue(coupleId, body.linkedMemoryId);\n      const takenAt = dateTimeOrNull(body.takenAt, 'Taken at');\n      const id = randomUUID();\n\n      await pool.query(\n        `INSERT INTO photos(id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id)\n         VALUES($1,$2,$3,$4,$5,$6,$7)`,\n        [\n          id,\n          coupleId,\n          request.userId,\n          mediaUrl,\n          optionalText(body.caption, 2000),\n          takenAt,\n          linkedMemoryId,\n        ],\n      );\n\n      const result = await pool.query(`${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`, [id, coupleId]);\n      broadcast(realtime, coupleId, 'photos', 'created', id);\n      return reply.code(201).send({ photo: result.rows[0] });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.patch('/photos/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Photo');\n      const body = request.body as Record<string, unknown>;\n      const currentResult = await pool.query('SELECT * FROM photos WHERE id=$1 AND couple_id=$2', [id, coupleId]);\n      const current = currentResult.rows[0];\n      if (!current) throw new ApiError(404, 'Photo not found.');\n\n      const mediaUrl = body.mediaUrl === undefined ? current.media_url : imageDataOrUrl(body.mediaUrl, 'Photo');\n      if (!mediaUrl) throw new ApiError(400, 'Photo is required.');\n      const caption = body.caption === undefined ? current.caption : optionalText(body.caption, 2000);\n      const takenAt = body.takenAt === undefined ? current.taken_at : dateTimeOrNull(body.takenAt, 'Taken at');\n      const linkedMemoryId = body.linkedMemoryId === undefined\n        ? current.linked_memory_id\n        : await memoryLinkValue(coupleId, body.linkedMemoryId);\n\n      await pool.query(\n        `UPDATE photos\n         SET media_url=$1,caption=$2,taken_at=$3,linked_memory_id=$4,updated_at=now()\n         WHERE id=$5 AND couple_id=$6`,\n        [mediaUrl, caption, takenAt, linkedMemoryId, id, coupleId],\n      );\n\n      const result = await pool.query(`${photoSelect} WHERE p.id=$1 AND p.couple_id=$2`, [id, coupleId]);\n      broadcast(realtime, coupleId, 'photos', 'updated', id);\n      return reply.send({ photo: result.rows[0] });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.delete('/photos/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Photo');\n      const result = await pool.query('DELETE FROM photos WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);\n      if (!result.rowCount) throw new ApiError(404, 'Photo not found.');\n      broadcast(realtime, coupleId, 'photos', 'deleted', id);\n      return reply.code(204).send();\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.get('/photo-albums', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const result = await pool.query(\n        `SELECT a.*,\n          (SELECT COUNT(*)::int FROM photo_album_items pai WHERE pai.album_id=a.id) AS photo_count,\n          (SELECT p.media_url\n             FROM photo_album_items pai\n             JOIN photos p ON p.id=pai.photo_id\n             WHERE pai.album_id=a.id\n             ORDER BY pai.sort_order,pai.created_at\n             LIMIT 1) AS cover_url\n         FROM photo_albums a\n         WHERE a.couple_id=$1\n         ORDER BY a.updated_at DESC,a.created_at DESC`,\n        [coupleId],\n      );\n      return reply.send({ albums: result.rows });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.post('/photo-albums', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const body = request.body as Record<string, unknown>;\n      const result = await pool.query(\n        `INSERT INTO photo_albums(id,couple_id,creator_id,title,description)\n         VALUES($1,$2,$3,$4,$5)\n         RETURNING *`,\n        [\n          randomUUID(),\n          coupleId,\n          request.userId,\n          requiredText(body.title, 'Album title', 160),\n          optionalText(body.description, 2000),\n        ],\n      );\n      broadcast(realtime, coupleId, 'photos', 'album-created', result.rows[0].id);\n      return reply.code(201).send({ album: result.rows[0] });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.get('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Album');\n\n      const albumResult = await pool.query(\n        `SELECT a.*,\n          (SELECT COUNT(*)::int FROM photo_album_items pai WHERE pai.album_id=a.id) AS photo_count,\n          (SELECT p.media_url\n             FROM photo_album_items pai\n             JOIN photos p ON p.id=pai.photo_id\n             WHERE pai.album_id=a.id\n             ORDER BY pai.sort_order,pai.created_at\n             LIMIT 1) AS cover_url\n         FROM photo_albums a\n         WHERE a.id=$1 AND a.couple_id=$2`,\n        [id, coupleId],\n      );\n      if (!albumResult.rows[0]) throw new ApiError(404, 'Album not found.');\n\n      const photosResult = await pool.query(\n        `${photoSelect}\n         JOIN photo_album_items pai ON pai.photo_id=p.id\n         WHERE pai.album_id=$1 AND p.couple_id=$2\n         ORDER BY pai.sort_order,COALESCE(p.taken_at,p.created_at) DESC,p.created_at DESC`,\n        [id, coupleId],\n      );\n      return reply.send({ album: albumResult.rows[0], photos: photosResult.rows });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.patch('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Album');\n      const body = request.body as Record<string, unknown>;\n      const currentResult = await pool.query('SELECT * FROM photo_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);\n      const current = currentResult.rows[0];\n      if (!current) throw new ApiError(404, 'Album not found.');\n\n      const result = await pool.query(\n        `UPDATE photo_albums\n         SET title=$1,description=$2,updated_at=now()\n         WHERE id=$3 AND couple_id=$4\n         RETURNING *`,\n        [\n          body.title === undefined ? current.title : requiredText(body.title, 'Album title', 160),\n          body.description === undefined ? current.description : optionalText(body.description, 2000),\n          id,\n          coupleId,\n        ],\n      );\n      broadcast(realtime, coupleId, 'photos', 'album-updated', id);\n      return reply.send({ album: result.rows[0] });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.post('/photo-albums/:id/photos', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Album');\n      const body = request.body as Record<string, unknown>;\n      const photoId = uuidValue(body.photoId, 'Photo');\n\n      const valid = await pool.query(\n        `SELECT 1\n         FROM photo_albums a\n         JOIN photos p ON p.couple_id=a.couple_id\n         WHERE a.id=$1 AND a.couple_id=$2 AND p.id=$3`,\n        [id, coupleId, photoId],\n      );\n      if (!valid.rowCount) throw new ApiError(404, 'Album or photo not found.');\n\n      const orderResult = await pool.query(\n        'SELECT COALESCE(MAX(sort_order),-1)+1 AS next_order FROM photo_album_items WHERE album_id=$1',\n        [id],\n      );\n      const nextOrder = Number(orderResult.rows[0]?.next_order ?? 0);\n\n      await pool.query(\n        `INSERT INTO photo_album_items(album_id,photo_id,added_by,sort_order)\n         VALUES($1,$2,$3,$4)\n         ON CONFLICT (album_id,photo_id) DO NOTHING`,\n        [id, photoId, request.userId, nextOrder],\n      );\n      await pool.query('UPDATE photo_albums SET updated_at=now() WHERE id=$1', [id]);\n      broadcast(realtime, coupleId, 'photos', 'album-photo-added', photoId);\n      return reply.code(201).send({ ok: true });\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.delete('/photo-albums/:id/photos/:photoId', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id, photoId } = request.params as { id: string; photoId: string };\n      uuidValue(id, 'Album');\n      uuidValue(photoId, 'Photo');\n\n      const albumResult = await pool.query('SELECT id FROM photo_albums WHERE id=$1 AND couple_id=$2', [id, coupleId]);\n      if (!albumResult.rowCount) throw new ApiError(404, 'Album not found.');\n\n      await pool.query('DELETE FROM photo_album_items WHERE album_id=$1 AND photo_id=$2', [id, photoId]);\n      await pool.query('UPDATE photo_albums SET updated_at=now() WHERE id=$1', [id]);\n      broadcast(realtime, coupleId, 'photos', 'album-photo-removed', photoId);\n      return reply.code(204).send();\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n\n  app.delete('/photo-albums/:id', { preHandler: authenticate }, async (request, reply) => {\n    try {\n      const coupleId = await requireCoupleId(request.userId);\n      const { id } = request.params as { id: string };\n      uuidValue(id, 'Album');\n      const result = await pool.query('DELETE FROM photo_albums WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);\n      if (!result.rowCount) throw new ApiError(404, 'Album not found.');\n      broadcast(realtime, coupleId, 'photos', 'album-deleted', id);\n      return reply.code(204).send();\n    } catch (error) {\n      return sendError(reply, error);\n    }\n  });\n}\n";
const photoServiceSource = "import { apiRequest } from './api';\nimport type { CouplePhoto, PhotoAlbum } from '@/types/database';\n\n// H1_STANDALONE_PHOTOS_DATA_MODEL: client API for first-class photos and photo-based albums.\nexport async function getPhotos() {\n  return (await apiRequest<{ photos: CouplePhoto[] }>('/photos')).photos;\n}\n\nexport async function getPhoto(id: string) {\n  return (await apiRequest<{ photo: CouplePhoto }>(`/photos/${id}`)).photo;\n}\n\nexport async function createPhoto(input: {\n  mediaUrl: string;\n  caption?: string;\n  takenAt?: string | null;\n  linkedMemoryId?: string | null;\n}) {\n  return (await apiRequest<{ photo: CouplePhoto }>('/photos', { method: 'POST', body: input })).photo;\n}\n\nexport async function updatePhoto(id: string, input: Partial<{\n  mediaUrl: string;\n  caption: string;\n  takenAt: string | null;\n  linkedMemoryId: string | null;\n}>) {\n  return (await apiRequest<{ photo: CouplePhoto }>(`/photos/${id}`, { method: 'PATCH', body: input })).photo;\n}\n\nexport function deletePhoto(id: string) {\n  return apiRequest<void>(`/photos/${id}`, { method: 'DELETE' });\n}\n\nexport async function getPhotoAlbums() {\n  return (await apiRequest<{ albums: PhotoAlbum[] }>('/photo-albums')).albums;\n}\n\nexport async function createPhotoAlbum(input: { title: string; description?: string }) {\n  return (await apiRequest<{ album: PhotoAlbum }>('/photo-albums', { method: 'POST', body: input })).album;\n}\n\nexport async function updatePhotoAlbum(id: string, input: Partial<{ title: string; description: string }>) {\n  return (await apiRequest<{ album: PhotoAlbum }>(`/photo-albums/${id}`, { method: 'PATCH', body: input })).album;\n}\n\nexport function getPhotoAlbum(id: string) {\n  return apiRequest<{ album: PhotoAlbum; photos: CouplePhoto[] }>(`/photo-albums/${id}`);\n}\n\nexport function addPhotoToAlbum(albumId: string, photoId: string) {\n  return apiRequest<{ ok: true }>(`/photo-albums/${albumId}/photos`, {\n    method: 'POST',\n    body: { photoId },\n  });\n}\n\nexport function removePhotoFromAlbum(albumId: string, photoId: string) {\n  return apiRequest<void>(`/photo-albums/${albumId}/photos/${photoId}`, { method: 'DELETE' });\n}\n\nexport function deletePhotoAlbum(id: string) {\n  return apiRequest<void>(`/photo-albums/${id}`, { method: 'DELETE' });\n}\n";
const photoTypesSource = "export type CouplePhoto = {\n  id: string;\n  couple_id: string;\n  creator_id: string;\n  media_url: string;\n  caption: string;\n  taken_at: string | null;\n  linked_memory_id: string | null;\n  linked_memory_title?: string | null;\n  linked_memory_date?: string | null;\n  created_at: string;\n  updated_at: string;\n};\n\nexport type PhotoAlbum = {\n  id: string;\n  couple_id: string;\n  creator_id: string;\n  title: string;\n  description: string;\n  photo_count?: number;\n  cover_url?: string | null;\n  created_at: string;\n  updated_at: string;\n};\n\n";

function fail(message) {
  console.error(`\n[H1] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function guardCompletedPhases() {
  const guards = [
    ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/app/(tabs)/plan.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
    ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/us/UsStoryDashboard.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['src/components/common/CollapsibleComposer.tsx', 'G6_COMPOSER_SHEETS'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any H1 write:\n- ${failures.join('\n- ')}`);

  const migration17 = read('server/migrations/017_shared_decision_wheel.sql');
  if (!migration17.trim()) fail('Migration 017 is missing or empty; refusing to guess the next migration number.');
}

function prepareNewFile(relativePath, output, preferredEol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { relativePath, output, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');
  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the H1 marker; refusing to overwrite unrelated work.`);
  }
  return { relativePath, output: source, eol, write: false };
}

function prepareApp() {
  const { source, eol } = sourceWithEol('server/src/app.ts');
  if (source.includes(MARKER)) return { relativePath: 'server/src/app.ts', output: source, eol, write: false };

  let next = replaceOnce(
    source,
    "import { registerMemoryRoutes } from './routes/memories.js';\n",
    "import { registerMemoryRoutes } from './routes/memories.js';\nimport { registerPhotoRoutes } from './routes/photos.js';\n",
    'server app photo route import',
  );
  next = replaceOnce(
    next,
    '  await registerMemoryRoutes(app, realtime);\n',
    `  await registerMemoryRoutes(app, realtime);\n  // ${MARKER}: first-class photo API is additive; legacy memory-photo routes stay registered unchanged.\n  await registerPhotoRoutes(app, realtime);\n`,
    'server app photo route registration',
  );

  return { relativePath: 'server/src/app.ts', output: next, eol, write: true };
}

function prepareTypes() {
  const { source, eol } = sourceWithEol('src/types/database.ts');
  if (source.includes(MARKER)) return { relativePath: 'src/types/database.ts', output: source, eol, write: false };

  const anchor = "export type MemoryPhoto = { id: string | null; media_url: string; caption: string; sort_order: number };\n";
  const next = replaceOnce(
    source,
    anchor,
    `// ${MARKER}: Photo is independent content; linking it to a Memory is optional.\n${photoTypesSource}${anchor}`,
    'database photo types',
  );

  return { relativePath: 'src/types/database.ts', output: next, eol, write: true };
}

function audit() {
  const migration = read('server/migrations/018_standalone_photos.sql').replace(/\r\n/g, '\n');
  const routes = read('server/src/routes/photos.ts').replace(/\r\n/g, '\n');
  const app = read('server/src/app.ts').replace(/\r\n/g, '\n');
  const service = read('src/services/backend/photos.ts').replace(/\r\n/g, '\n');
  const types = read('src/types/database.ts').replace(/\r\n/g, '\n');
  const memories = read('server/src/routes/memories.ts').replace(/\r\n/g, '\n');
  const failures = [];

  if (!migration.includes(MARKER)) failures.push('Migration marker missing');
  for (const table of ['CREATE TABLE IF NOT EXISTS photos', 'CREATE TABLE IF NOT EXISTS photo_albums', 'CREATE TABLE IF NOT EXISTS photo_album_items']) {
    if (!migration.includes(table)) failures.push(`Migration missing ${table}`);
  }
  if (!migration.includes('linked_memory_id uuid REFERENCES memories(id) ON DELETE SET NULL')) failures.push('Optional Memory link missing');

  if (!routes.includes(MARKER)) failures.push('Photo routes marker missing');
  for (const route of [
    "app.get('/photos'",
    "app.get('/photos/:id'",
    "app.post('/photos'",
    "app.patch('/photos/:id'",
    "app.delete('/photos/:id'",
    "app.get('/photo-albums'",
    "app.post('/photo-albums'",
    "app.get('/photo-albums/:id'",
    "app.patch('/photo-albums/:id'",
    "app.post('/photo-albums/:id/photos'",
    "app.delete('/photo-albums/:id/photos/:photoId'",
    "app.delete('/photo-albums/:id'",
  ]) {
    if (!routes.includes(route)) failures.push(`Photo API missing ${route}`);
  }
  if (!routes.includes("broadcast(realtime, coupleId, 'photos'")) failures.push('Photo realtime resource missing');
  if (!routes.includes('imageDataOrUrl(body.mediaUrl')) failures.push('Photo image validation missing');

  if (!app.includes(MARKER) || !app.includes("import { registerPhotoRoutes } from './routes/photos.js';") || !app.includes('await registerPhotoRoutes(app, realtime);')) {
    failures.push('Photo routes are not registered in server app');
  }

  if (!service.includes(MARKER)) failures.push('Client photo service marker missing');
  for (const fn of ['getPhotos', 'getPhoto', 'createPhoto', 'updatePhoto', 'deletePhoto', 'getPhotoAlbums', 'createPhotoAlbum', 'updatePhotoAlbum', 'getPhotoAlbum', 'addPhotoToAlbum', 'removePhotoFromAlbum', 'deletePhotoAlbum']) {
    if (!service.includes(`function ${fn}`)) failures.push(`Client photo API missing ${fn}`);
  }

  if (!types.includes(MARKER) || !types.includes('export type CouplePhoto') || !types.includes('export type PhotoAlbum')) {
    failures.push('Photo client types missing');
  }

  // H1 must not rewrite or remove the legacy Memory photo path.
  if (!memories.includes('function photoValues(') || !memories.includes('memory_media') || !memories.includes("app.get('/memory-albums'")) {
    failures.push('Legacy Memory photo/album path no longer looks intact');
  }

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[H1] ${label}`);
  let result;

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[H1] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const app = prepareApp();
  const types = prepareTypes();
  const migration17 = sourceWithEol('server/migrations/017_shared_decision_wheel.sql');
  const serviceBase = sourceWithEol('src/services/backend/mvpFeatures.ts');

  pending = [
    prepareNewFile('server/migrations/018_standalone_photos.sql', migrationSource, migration17.eol),
    prepareNewFile('server/src/routes/photos.ts', photoRoutesSource, app.eol),
    app,
    types,
    prepareNewFile('src/services/backend/photos.ts', photoServiceSource, serviceBase.eol),
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every modified output is prepared before the first source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[H1] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[H1] ${item.relativePath}: ready`);
}

console.log('\n[H1] Source audit');
audit();
console.log('[H1] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['--prefix', 'server', 'run', 'migrate'], 'Database migration 018');
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[H1] ALL VALIDATIONS PASSED');
console.log('[H1] Migration 018 is applied. Existing memory photos/albums remain untouched for H3 compatibility work.');
