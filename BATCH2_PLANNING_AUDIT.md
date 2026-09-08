# Togetherly v1.14.3 — Batch 2 Planning Audit

Scope: Tasks, Lists, Calendar and Countdowns, checked against the current GitHub `main` branch.

## Findings and fixes

### Countdowns
- Fixed long-distance date drift by treating countdowns as date-based values rather than viewer-local instants. A countdown entered as October 22 now stays October 22 for both partners.
- Countdown editing now reads the stored calendar date consistently.
- Remaining-day/progress calculations use the calendar date rather than time-zone-shifted instants.
- Added a one-minute UI clock refresh so countdown figures do not remain stale while the screen stays open.

### Calendar
- Multi-day all-day events are now indexed on every covered day in Month view instead of appearing only on their first day.
- Existing recurrence/date-clamping logic was retained.

### Lists
- Web links now accept friendly input such as `example.com` and normalize it to HTTPS.
- Invalid/non-web links are rejected before saving.
- Failed link opening now shows an error instead of silently doing nothing.

### Tasks
- Reviewed task creation/editing, assignment, recurrence, checklist timing, optimistic completion and conflict protection. No source change was necessary in this batch. The current backend already validates date-only fields, recurring tasks, step dates, durations and stale-edit conflicts.

## Regression checklist
1. Create/edit/complete a normal task.
2. Create a recurring task and complete it; confirm the next occurrence appears once.
3. Create a task with checklist dates/durations.
4. Create a list, add/edit/check/uncheck/delete an item.
5. Save `example.com` as an item link and open it.
6. Create a 3-day all-day calendar event and confirm all 3 days show it in Month view.
7. Create timed and recurring calendar events and verify Month/Week/Agenda.
8. Create a countdown on one partner phone and confirm the other partner sees the exact same target date.
9. Leave Countdowns open for more than a minute and confirm displayed calculations refresh.
