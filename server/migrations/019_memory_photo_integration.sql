-- H3_MEMORY_PHOTO_INTEGRATION
-- Compatibility bridge from Memory-owned images/albums to first-class H1/H2 Photos.
-- Legacy tables and columns are deliberately retained; this migration copies rather than destroys.

ALTER TABLE photos ADD COLUMN IF NOT EXISTS memory_sort_order integer;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_memory_sort_order_check;
ALTER TABLE photos ADD CONSTRAINT photos_memory_sort_order_check
  CHECK (memory_sort_order IS NULL OR memory_sort_order >= 0);

CREATE INDEX IF NOT EXISTS photos_memory_order_idx
  ON photos(linked_memory_id, memory_sort_order, created_at)
  WHERE linked_memory_id IS NOT NULL;

-- Import every currently renderable memory_media image into first-class Photos.
-- Deterministic UUIDs make the copy stable if this SQL is ever replayed outside schema_migrations.
INSERT INTO photos(
  id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order,created_at,updated_at
)
SELECT
  md5('h3-memory-media:' || mm.id::text)::uuid,
  m.couple_id,
  m.creator_id,
  mm.media_url,
  COALESCE(mm.caption,''),
  (m.memory_date::timestamp AT TIME ZONE 'UTC'),
  m.id,
  GREATEST(mm.sort_order,0),
  mm.created_at,
  GREATEST(mm.created_at,m.updated_at)
FROM memory_media mm
JOIN memories m ON m.id=mm.memory_id
WHERE mm.media_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM photos p
    WHERE p.couple_id=m.couple_id
      AND p.linked_memory_id=m.id
      AND p.media_url=mm.media_url
  )
ON CONFLICT (id) DO NOTHING;

-- Older installs may only have memories.photo_url. Preserve those too when no
-- first-class copy of the same Memory/image exists yet.
INSERT INTO photos(
  id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order,created_at,updated_at
)
SELECT
  md5('h3-memory-fallback:' || m.id::text || ':' || m.photo_url)::uuid,
  m.couple_id,
  m.creator_id,
  m.photo_url,
  '',
  (m.memory_date::timestamp AT TIME ZONE 'UTC'),
  m.id,
  0,
  m.created_at,
  m.updated_at
FROM memories m
WHERE m.photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM photos p
    WHERE p.couple_id=m.couple_id
      AND p.linked_memory_id=m.id
      AND p.media_url=m.photo_url
  )
ON CONFLICT (id) DO NOTHING;

-- Preserve existing Memory Album organization by creating a corresponding
-- photo-based Album. The old memory_albums rows remain untouched.
INSERT INTO photo_albums(id,couple_id,creator_id,title,description,created_at,updated_at)
SELECT
  md5('h3-memory-album:' || a.id::text)::uuid,
  a.couple_id,
  a.creator_id,
  a.title,
  a.description,
  a.created_at,
  a.updated_at
FROM memory_albums a
WHERE NOT EXISTS (
  SELECT 1 FROM photo_albums pa
  WHERE pa.id=md5('h3-memory-album:' || a.id::text)::uuid
)
ON CONFLICT (id) DO NOTHING;

-- A legacy Memory Album contained Memories. Expand each of those Memories into
-- its linked first-class Photos so the visible H2 album keeps the actual images.
WITH expanded AS (
  SELECT
    md5('h3-memory-album:' || mai.album_id::text)::uuid AS album_id,
    p.id AS photo_id,
    mai.added_by,
    (ROW_NUMBER() OVER (
      PARTITION BY mai.album_id
      ORDER BY mai.created_at, COALESCE(p.memory_sort_order, 1000000), COALESCE(p.taken_at,p.created_at), p.id
    ) - 1)::integer AS sort_order,
    mai.created_at
  FROM memory_album_items mai
  JOIN memory_albums a ON a.id=mai.album_id
  JOIN photos p ON p.linked_memory_id=mai.memory_id AND p.couple_id=a.couple_id
)
INSERT INTO photo_album_items(album_id,photo_id,added_by,sort_order,created_at)
SELECT album_id,photo_id,added_by,sort_order,created_at
FROM expanded
ON CONFLICT (album_id,photo_id) DO NOTHING;
