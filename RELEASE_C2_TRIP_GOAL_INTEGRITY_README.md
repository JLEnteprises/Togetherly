# Togetherly Release C2 — Trips & Goals Integrity

C2 fixes two planning-model problems rather than adding more surface area.

## 1. Trip quick-setup items stay synchronized

Quick Setup can create a Countdown and Calendar event from a Trip. Before C2, those records were only linked; editing the Trip afterward left them stale.

C2 distinguishes:

- **trip-managed** Countdown/Event = created by Trip Quick Setup and kept synchronized;
- **manual link** = an existing item you linked yourself and Togetherly leaves independent.

When a managed Trip is edited, Togetherly updates:

- trip title → calendar title + `<trip> begins` countdown title;
- trip start date → countdown target + calendar start;
- trip end date → calendar end;
- destination → calendar location;
- trip notes → calendar description.

The Trip planner labels these items **SYNCED TO TRIP**.

Migration 014 safely recognizes older Quick Setup links when their generated pattern is still identifiable.

## 2. Goal totals cannot drift from contribution history

Before C2, the Goal editor could directly change `current_value` while the separate contribution history stayed untouched.

C2 makes progress history-backed:

- a new Goal may have an optional **Starting amount**;
- that starting amount is recorded as a real contribution;
- editing a Goal can change title/description/target/unit/deadline, but not its current total;
- progress changes use **Add progress**;
- negative progress remains available for corrections;
- the server rejects attempts to directly change a Goal total.

Migration 014 preserves existing totals by creating one `Imported previous total` contribution only where an old Goal's total and contribution sum differ.

## Migration required

Run this after applying the patch:

```cmd
npm.cmd run backend:migrate
```

Then:

```cmd
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_C2_TRIP_GOAL_AUDIT_REMAINING.txt` appears, send it before committing.

## Manual tests worth doing

Trip sync:
1. Create a Trip with dates/destination.
2. Use Quick Setup to create Countdown + Calendar dates.
3. Edit the Trip's title, destination and dates.
4. Open the linked Countdown and Calendar event: they should match the Trip.
5. Link an unrelated existing Event manually, edit the Trip, and confirm that unrelated Event does **not** change.

Goal integrity:
1. Create a Goal with a non-zero Starting amount.
2. Confirm its contribution history includes that amount.
3. Edit the Goal; there should be no editable Current field.
4. Add progress and confirm total/history move together.
5. Add a negative correction and confirm both remain consistent.
