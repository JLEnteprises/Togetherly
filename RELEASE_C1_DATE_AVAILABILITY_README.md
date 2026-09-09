# Togetherly Release C1 — Date Math & Real Availability

Release C starts with planning correctness rather than new screens.

## Fixes

### Countdown consistency

Countdowns are date-based objects, so Togetherly now calculates them using **calendar dates**, not elapsed milliseconds.

This means:

- the Countdowns screen and Long Distance Home card use the exact same calculation;
- a countdown decrements when your local calendar date changes;
- DST 23/25-hour days cannot make the day count drift;
- the target remains the active "next countdown" for the whole target day;
- progress is based on elapsed calendar days rather than the arbitrary UTC-noon storage timestamp.

### Availability semantics

Before C1, only rows marked `Free` were read by the overlap engine. `Work`, `Sleep`, and `Busy` were displayed but did not actually remove time from availability.

C1 changes the model to:

**effective availability = Free − Work − Sleep − Busy**

It also handles blocking windows that run overnight.

Example:

- Free: 6 PM → 11 PM
- Work: 6 PM → 8 PM

Togetherly now treats **8 PM → 11 PM** as free.

No database migration is required.

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_C1_DATE_AVAILABILITY.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

Expected new logic output includes:

```text
PASS countdown calendar-day consistency
```

If `RELEASE_C1_DATE_AVAILABILITY_AUDIT_REMAINING.txt` appears, send it before committing.

## Useful manual test

Set both accounts to overlapping Free windows. Then add a Work or Busy window inside one person's Free window. Refresh Availability: the shared overlap should shrink around the blocking window rather than ignoring it.
