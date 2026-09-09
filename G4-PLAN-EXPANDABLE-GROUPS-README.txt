Togetherly v1.14.3 — Release G4: Plan Expandable Groups

Verified baseline
-----------------
GitHub head:
5be3e1439e243b51c5831d5adac22309bd4fe3ff

G3 was verified as one clean commit above G2 with exactly the intended G3 files.

What G4 changes
---------------
Plan keeps the same canonical feature ownership, but no longer exposes every feature row at once.

Day to day
- collapsed live summary of open Tasks, Lists and Notes
- expands to Tasks / Lists / Notes

Dates & time
- collapsed live summary using the next calendar occurrence, next Countdown and/or next availability overlap
- expands to Calendar / Countdowns / Availability

Looking ahead
- collapsed live summary of the next Trip and active Goals
- expands to Trips / Goals

Only one major Plan group can be expanded at a time.

No feature screen is removed.
No backend route is changed.
No migration is required.

Files changed
-------------
src/app/(tabs)/plan.tsx
src/components/plan/PlanHubGroups.tsx

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G4_PLAN_EXPANDABLE_GROUPS.js

Automatic validations
---------------------
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

No migration.
No dependency changes.
Do not run expo lint.

Safety
------
- completed E1–F3 and G1–G3 markers are checked before writes
- all outputs are prepared before any source file is written
- CRLF/LF style is preserved
- unrelated pre-existing PlanHubGroups.tsx is never overwritten
- installer is safe to run twice

Checkpoint only after:
[G4] ALL VALIDATIONS PASSED
