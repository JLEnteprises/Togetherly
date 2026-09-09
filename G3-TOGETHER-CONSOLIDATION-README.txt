Togetherly v1.14.3 — Release G3: Together Consolidation

Verified baseline
-----------------
GitHub head:
90174e3a2063d2a76381401097c5c737ccb5abd4

G2 was verified as one clean commit above G1 with exactly the intended G2 files.

What G3 changes
---------------
Together becomes the canonical feature home for:
- immediate relationship connection
- mood/check-in entry
- Daily Question / check-in context
- Play Together
- Date Ideas
- Live Location context

The new hierarchy is:

Between you
- Love Tap
- Thinking of You
- How I'm feeling

Check in
- collapsed summary of today's question + partner check-in recency
- expands to Daily Question and Live Location
- Mood is NOT repeated here because "How I'm feeling" above is the single normal Mood CTA

Play
- collapsed active-game summary
- expands to active game (when present) + Play Together

Things to do
- collapsed saved-date-idea count
- expands to Date Ideas

Only one major expandable group is open at a time.

Files changed
-------------
src/components/dashboard/HomeConnectionActions.tsx
src/app/(tabs)/together.tsx
src/components/together/TogetherHubGroups.tsx

Home behavior is preserved:
- Home still shows Love Tap / Thinking of You only
- the generic Home Mood CTA does not return

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G3_TOGETHER_CONSOLIDATION.js

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
- completed E1–F3, G1 and G2 markers are checked before writes
- all source outputs are prepared before any source file is written
- existing CRLF/LF style is preserved per file
- unrelated pre-existing TogetherHubGroups.tsx is never overwritten
- installer is safe to run twice

Checkpoint only after:
[G3] ALL VALIDATIONS PASSED
