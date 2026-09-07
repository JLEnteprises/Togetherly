-- Togetherly v1.8: lightweight metadata for richer shared scratchpad content.
ALTER TABLE shared_items ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
