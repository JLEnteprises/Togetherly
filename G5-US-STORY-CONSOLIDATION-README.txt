Togetherly v1.14.3 — Release G5: Us / Story Consolidation

Verified baseline
-----------------
GitHub head:
ebd67da50053c0acf5592b83a4a60bd1e5dd60e8

G4 was verified as one clean commit above G3 with exactly the intended G4 files.

What G5 changes
---------------
Us becomes the single relationship-story navigation dashboard.

Us now has compact story summaries for:
- Memories
- Photos
- Timeline
- Rediscover

Memories
- shows memory count + latest saved memory date
- opens the dedicated Memories screen

Photos
- shows current photo count + album count
- opens Photos
- this still uses the existing memory-backed photo architecture for now
- standalone Photo data comes later in H1–H3

Timeline
- shows milestone count + relationship age when available
- opens Timeline

Rediscover
- expandable
- surfaces On This Day when there is a matching past memory
- opens the matching Memory directly
- always includes Memory Jar

Memories screen cleanup
-----------------------
The redundant "Our story" block containing:
- Photos
- Timeline
- Memory Jar

is removed from Memories.

Memories keeps:
- create/edit flow
- filters
- memory cards
- photo previews
- detail modal
- milestone controls
- tags

So Memories now focuses on memories themselves.

Files changed
-------------
src/app/(tabs)/us.tsx
src/components/us/UsStoryDashboard.tsx
src/app/features/memories.tsx

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G5_US_STORY_CONSOLIDATION.js

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
- completed E1–F3 and G1–G4 markers are checked before writes
- all modified outputs are prepared before any source file is written
- CRLF/LF style is preserved
- unrelated pre-existing UsStoryDashboard.tsx is never overwritten
- Memories is patched only at the known duplicate story-navigation anchors
- installer is safe to run twice

Checkpoint only after:
[G5] ALL VALIDATIONS PASSED
