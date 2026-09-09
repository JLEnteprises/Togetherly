# Shared note editing hotfix

## Cause

Shared notes are intentionally editable by either member of the couple.

The note update endpoint uses `updatedAt` as an optimistic concurrency token. The client sends a JavaScript timestamp with millisecond precision, but PostgreSQL `timestamptz` can retain finer sub-millisecond precision.

The update SQL compared the database value directly with the client timestamp:

```sql
updated_at = $7::timestamptz
```

That can reject an unchanged note with HTTP 409 because the two timestamps represent the same displayed millisecond but differ in hidden microseconds.

## Fix

Compare both values at millisecond precision:

```sql
date_trunc('milliseconds', updated_at)
=
date_trunc('milliseconds', $7::timestamptz)
```

This preserves stale-edit protection while making it compatible with timestamps that have passed through JavaScript.

No database migration is required.
