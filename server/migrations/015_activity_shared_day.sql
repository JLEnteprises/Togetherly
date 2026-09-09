-- Togetherly Release C3: independent activity favourites + stable shared-day timezone.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;

-- Old builds stored Favourite as the lifecycle status itself. Preserve the
-- favourite flag, then return the item to the ordinary idea lifecycle.
UPDATE activities
SET is_favourite = true,
    status = 'want_to_do',
    updated_at = now()
WHERE status = 'favourite';

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE activities
  ADD CONSTRAINT activities_status_check
  CHECK (status IN ('want_to_do', 'planned', 'completed', 'do_again', 'skip'));

ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS shared_day_timezone text;

-- Freeze the relationship's daily-question boundary to the timezone of the
-- current owner at upgrade time. It no longer changes at UTC midnight or when
-- the two partners happen to be in different local dates.
UPDATE couples c
SET shared_day_timezone = COALESCE(NULLIF(u.timezone, ''), 'UTC')
FROM users u
WHERE c.owner_user_id = u.id
  AND (c.shared_day_timezone IS NULL OR btrim(c.shared_day_timezone) = '');

UPDATE couples
SET shared_day_timezone = 'UTC'
WHERE shared_day_timezone IS NULL OR btrim(shared_day_timezone) = '';

ALTER TABLE couples
  ALTER COLUMN shared_day_timezone SET DEFAULT 'UTC',
  ALTER COLUMN shared_day_timezone SET NOT NULL;
