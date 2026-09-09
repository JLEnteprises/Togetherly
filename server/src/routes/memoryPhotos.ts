import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ApiError } from '../utils/http.js';
import { imageDataOrUrl } from './helpers.js';

function uuidValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }
  return value;
}

export function memoryPhotoIds(body: Record<string, unknown>, key = 'photoIds') {
  if (body[key] === undefined) return undefined;
  if (!Array.isArray(body[key])) throw new ApiError(400, 'Existing photos are invalid.');
  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');

  const values = (body[key] as unknown[]).map((value, index) => uuidValue(value, `Photo ${index + 1}`));
  return [...new Set(values)];
}

export function memoryPhotoUrls(body: Record<string, unknown>, key = 'photoUrls') {
  if (body[key] === undefined) return undefined;
  if (!Array.isArray(body[key])) throw new ApiError(400, 'New photos are invalid.');
  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');

  return (body[key] as unknown[])
    .map((value, index) => imageDataOrUrl(value, `Photo ${index + 1}`))
    .filter((value): value is string => Boolean(value));
}

export function memoryPhotosSql(alias: string) {
  return `CASE
    WHEN EXISTS (SELECT 1 FROM photos px WHERE px.linked_memory_id=${alias}.id)
      THEN COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', ranked.id,
            'media_url', ranked.media_url,
            'caption', ranked.caption,
            'sort_order', ranked.sort_order
          )
          ORDER BY ranked.sort_order, ranked.created_at
        )
        FROM (
          SELECT p.id,p.media_url,p.caption,p.created_at,
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id
            ) - 1 AS sort_order
          FROM photos p
          WHERE p.linked_memory_id=${alias}.id
        ) ranked
      ), '[]'::json)
    WHEN EXISTS (SELECT 1 FROM memory_media mmx WHERE mmx.memory_id=${alias}.id)
      THEN COALESCE((
        SELECT json_agg(
          json_build_object('id',mm.id,'media_url',mm.media_url,'caption',mm.caption,'sort_order',mm.sort_order)
          ORDER BY mm.sort_order,mm.created_at
        )
        FROM memory_media mm
        WHERE mm.memory_id=${alias}.id AND mm.media_url IS NOT NULL
      ), '[]'::json)
    WHEN ${alias}.photo_url IS NOT NULL
      THEN json_build_array(json_build_object('id',NULL,'media_url',${alias}.photo_url,'caption','','sort_order',0))
    ELSE '[]'::json
  END AS photos`;
}

export async function syncStandaloneMemoryPhotos(client: PoolClient, input: {
  coupleId: string;
  memoryId: string;
  creatorId: string;
  memoryDate: string;
  photoIds: string[];
  photoUrls: string[];
}) {
  const photoIds = [...new Set(input.photoIds)];
  if (photoIds.length + input.photoUrls.length > 8) {
    throw new ApiError(400, 'A memory can contain up to 8 photos.');
  }

  if (photoIds.length) {
    const existing = await client.query(
      `SELECT id,linked_memory_id
       FROM photos
       WHERE couple_id=$1 AND id=ANY($2::uuid[])
       FOR UPDATE`,
      [input.coupleId, photoIds],
    );
    if ((existing.rowCount ?? 0) !== photoIds.length) {
      throw new ApiError(400, 'One or more selected photos do not belong to this couple.');
    }
    if (existing.rows.some((row) => row.linked_memory_id && String(row.linked_memory_id) !== input.memoryId)) {
      throw new ApiError(409, 'One of those photos is already linked to another memory.');
    }
  }

  await client.query(
    `UPDATE photos
     SET linked_memory_id=NULL,memory_sort_order=NULL,updated_at=now()
     WHERE couple_id=$1 AND linked_memory_id=$2
       AND NOT (id=ANY($3::uuid[]))`,
    [input.coupleId, input.memoryId, photoIds],
  );

  for (let index = 0; index < photoIds.length; index += 1) {
    await client.query(
      `UPDATE photos
       SET linked_memory_id=$1,memory_sort_order=$2,updated_at=now()
       WHERE id=$3 AND couple_id=$4`,
      [input.memoryId, index, photoIds[index], input.coupleId],
    );
  }

  for (let index = 0; index < input.photoUrls.length; index += 1) {
    await client.query(
      `INSERT INTO photos(
        id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order
      ) VALUES($1,$2,$3,$4,'',$5::date::timestamp AT TIME ZONE 'UTC',$6,$7)`,
      [
        randomUUID(),
        input.coupleId,
        input.creatorId,
        input.photoUrls[index],
        input.memoryDate,
        input.memoryId,
        photoIds.length + index,
      ],
    );
  }

  const result = await client.query(
    `SELECT p.id,p.media_url,p.caption,
       ROW_NUMBER() OVER (
         ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id
       ) - 1 AS sort_order
     FROM photos p
     WHERE p.couple_id=$1 AND p.linked_memory_id=$2
     ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id`,
    [input.coupleId, input.memoryId],
  );

  await client.query(
    'UPDATE memories SET photo_url=$1 WHERE id=$2 AND couple_id=$3',
    [result.rows[0]?.media_url ?? null, input.memoryId, input.coupleId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    media_url: String(row.media_url),
    caption: String(row.caption ?? ''),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

// H3_MEMORY_PHOTO_INTEGRATION: Memory photo association is now a link to first-class Photos; un-linking never deletes the Photo.
