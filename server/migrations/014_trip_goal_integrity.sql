-- Togetherly Release C2: trip-managed planning links + goal history integrity.

ALTER TABLE trip_links
  ADD COLUMN IF NOT EXISTS managed_by_trip boolean NOT NULL DEFAULT false;

-- Recognise quick-setup links created by older Togetherly builds where it is
-- safe to infer ownership from the generated naming/date pattern.
UPDATE trip_links tl
SET managed_by_trip = true
FROM trips tr, countdowns c
WHERE tl.trip_id = tr.id
  AND tl.entity_type = 'countdown'
  AND tl.entity_id = c.id
  AND c.couple_id = tr.couple_id
  AND c.title = tr.title || ' begins';

UPDATE trip_links tl
SET managed_by_trip = true
FROM trips tr, events e
WHERE tl.trip_id = tr.id
  AND tl.entity_type = 'event'
  AND tl.entity_id = e.id
  AND e.couple_id = tr.couple_id
  AND e.all_day = true
  AND tr.start_date IS NOT NULL
  AND e.start_date = tr.start_date
  AND e.title = tr.title;

-- Existing goals may have been directly edited before C2. Preserve their
-- visible total by recording the gap as one historical baseline contribution.
WITH totals AS (
  SELECT
    g.id,
    g.creator_id,
    g.current_value,
    g.created_at,
    COALESCE(SUM(gc.amount), 0)::numeric(14,2) AS contribution_total
  FROM goals g
  LEFT JOIN goal_contributions gc ON gc.goal_id = g.id
  GROUP BY g.id, g.creator_id, g.current_value, g.created_at
),
gaps AS (
  SELECT
    id,
    creator_id,
    created_at,
    (current_value - contribution_total)::numeric(14,2) AS gap
  FROM totals
)
INSERT INTO goal_contributions(id, goal_id, creator_id, amount, note, created_at)
SELECT
  (
    substr(md5(id::text || ':c2-baseline'), 1, 8) || '-' ||
    substr(md5(id::text || ':c2-baseline'), 9, 4) || '-' ||
    substr(md5(id::text || ':c2-baseline'), 13, 4) || '-' ||
    substr(md5(id::text || ':c2-baseline'), 17, 4) || '-' ||
    substr(md5(id::text || ':c2-baseline'), 21, 12)
  )::uuid,
  id,
  creator_id,
  gap,
  'Imported previous total',
  created_at
FROM gaps
WHERE gap <> 0
ON CONFLICT (id) DO NOTHING;
