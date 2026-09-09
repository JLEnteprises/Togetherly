import type { PoolClient } from 'pg';

// Expand near the proposed interval only. Preserve the creator's wall-clock time
// across DST; PostgreSQL clamps month-end and leap-day interval arithmetic.
export async function hasPlanConflict(client: PoolClient, coupleId: string, start: string | Date, end: string | Date, excludedId: string | null) {
  const result = await client.query(`
    WITH source AS (
      SELECT e.*, COALESCE(u.timezone,'UTC') AS zone,
        CASE WHEN e.all_day THEN COALESCE(e.start_date, (e.start_at AT TIME ZONE COALESCE(u.timezone,'UTC'))::date)::timestamp
          ELSE e.start_at AT TIME ZONE COALESCE(u.timezone,'UTC') END AS anchor,
        CASE WHEN e.all_day THEN (GREATEST(0,COALESCE(e.end_date,e.start_date)-e.start_date)+1)*interval '1 day'
          ELSE GREATEST(interval '1 minute',COALESCE(e.end_at,e.start_at+interval '30 minutes')-e.start_at) END AS duration
      FROM events e JOIN users u ON u.id=e.creator_id
      WHERE e.couple_id=$1 AND ($4::uuid IS NULL OR e.id<>$4)
    ), periods AS (
      SELECT *, CASE recurrence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days'
        WHEN 'monthly' THEN interval '1 month' WHEN 'yearly' THEN interval '1 year' ELSE interval '1 day' END AS step,
        ($2::timestamptz AT TIME ZONE zone)-duration AS lower_bound,
        $3::timestamptz AT TIME ZONE zone AS upper_bound
      FROM source
    ), candidates AS (
      SELECT *, CASE recurrence
        WHEN 'daily' THEN floor(extract(epoch FROM (lower_bound-anchor))/86400)::int
        WHEN 'weekly' THEN floor(extract(epoch FROM (lower_bound-anchor))/604800)::int
        WHEN 'monthly' THEN ((extract(year FROM lower_bound)-extract(year FROM anchor))*12+extract(month FROM lower_bound)-extract(month FROM anchor))::int
        WHEN 'yearly' THEN (extract(year FROM lower_bound)-extract(year FROM anchor))::int ELSE 0 END AS first_n,
        CASE recurrence
        WHEN 'daily' THEN ceil(extract(epoch FROM (upper_bound-anchor))/86400)::int
        WHEN 'weekly' THEN ceil(extract(epoch FROM (upper_bound-anchor))/604800)::int
        WHEN 'monthly' THEN ((extract(year FROM upper_bound)-extract(year FROM anchor))*12+extract(month FROM upper_bound)-extract(month FROM anchor))::int
        WHEN 'yearly' THEN (extract(year FROM upper_bound)-extract(year FROM anchor))::int ELSE 0 END AS last_n
      FROM periods
    )
    SELECT id FROM candidates CROSS JOIN LATERAL generate_series(
      CASE WHEN recurrence='none' THEN 0 ELSE GREATEST(0,first_n-2) END,
      CASE WHEN recurrence='none' THEN 0 ELSE GREATEST(0,last_n+2) END
    ) AS series(n)
    WHERE (anchor+n*step) AT TIME ZONE zone < $3::timestamptz
      AND CASE WHEN all_day THEN (anchor+n*step+duration) AT TIME ZONE zone
        ELSE ((anchor+n*step) AT TIME ZONE zone)+duration END > $2::timestamptz
    LIMIT 1`, [coupleId, start, end, excludedId]);
  return Boolean(result.rowCount);
}
