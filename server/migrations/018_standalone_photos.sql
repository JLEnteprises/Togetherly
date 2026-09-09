-- H1_STANDALONE_PHOTOS_DATA_MODEL
-- First-class photos and photo-based albums.
-- Existing memory_media / memory_albums remain untouched until H3 compatibility work.

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  media_url text NOT NULL CHECK (char_length(media_url) BETWEEN 1 AND 8000000),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 2000),
  taken_at timestamptz,
  linked_memory_id uuid REFERENCES memories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_couple_date_idx
  ON photos(couple_id, taken_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_linked_memory_idx
  ON photos(linked_memory_id) WHERE linked_memory_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS photo_albums (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_albums_couple_idx
  ON photo_albums(couple_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS photo_album_items (
  album_id uuid NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, photo_id)
);

CREATE INDEX IF NOT EXISTS photo_album_items_photo_idx
  ON photo_album_items(photo_id);
CREATE INDEX IF NOT EXISTS photo_album_items_album_order_idx
  ON photo_album_items(album_id, sort_order, created_at);
