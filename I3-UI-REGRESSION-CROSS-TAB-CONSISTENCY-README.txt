Togetherly v1.14.3 — Release I3: UI Regression / Cross-tab Consistency

Verified baseline
-----------------
GitHub head:
972326006501713785f88865269b9f209295f3a4

I2 was verified one clean commit above I1 with exactly:
- APPLY_RELEASE_I2_DRAWING_PERFORMANCE_HARDENING.js
- I2-DRAWING-PERFORMANCE-HARDENING-README.txt
- src/components/common/DrawingCanvas.tsx
- src/components/dashboard/SharedScratchpadCard.tsx

Why I3 is audit-driven
----------------------
The redesign handoff defines I3 as verification:
- no duplicate CTAs
- no navigation dead ends
- expandable widget behavior
- back behavior
- sheets
- photo flows
- Scratchpad collaboration
- accessibility

The current inspected UI hierarchy does not show a regression that justifies another runtime rewrite.

So I3 adds a permanent repeatable audit instead of changing working screens just to create churn.

New audit
---------
scripts/i3-ui-regression-audit.mjs

It checks:

1. Literal feature-route integrity
- builds the Expo Router route set from src/app
- scans src for literal /features/... destinations
- fails when a literal destination has no route

2. Home / Together ownership
- Home does not directly own Mood
- Home quick slot remains active-game-only
- Together owns the single Mood entry
- Check In does not duplicate Mood
- Daily Question and Location remain in Check In
- Play Together remains in Play
- Date Ideas remains in Things to do

3. Plan
- exclusive expandable behavior remains
- Tasks / Lists / Notes appear once
- Calendar / Countdowns / Availability appear once
- Trips / Goals appear once
- generic Plan navigation remains neutral

4. Us / story
- one Memories destination
- one Photos destination
- one Timeline destination
- Rediscover owns Memory Jar
- Memories does not re-add the old story navigation block
- Us photo count still uses first-class Photos

5. ExpandableFeatureGroup
- accessibility expanded state
- controlled/uncontrolled toggle behavior
- disabled item semantics

6. BackHeader
- Back is an accessible button
- nested screens can still supply custom onBack behavior
- normal screens retain router.back()

7. ComposerSheet
- Modal
- keyboard avoidance
- scrollable form body
- native/back close
- accessible close controls

It also verifies the major composer screens still use ComposerSheet and do not regress to CollapsibleComposer.

8. Photos
- H2 standalone gallery stays canonical
- PhotoViewer remains fullscreen/swipe-paged
- Photos does not regress to MemoryDetailModal/getMemoryAlbums
- Memories keeps H3 MemoryPhotoField + PhotoViewer + photo realtime

9. Scratchpad
- I1 fullscreen remains connected
- I2 performance hardening remains connected
- partner presence remains
- remote conflict protection remains
- no slice(-120)
- no JSON.stringify(strokes) dirty regression
- committed/live layer split and frame throttling remain

10. Participant identity/accessibility
- Together and Us retain CoupleIdentitySignature
- Plan generic navigation stays neutral
- critical interactive primitives retain accessibility roles/states/labels

Files changed
-------------
scripts/i3-ui-regression-audit.mjs

Plus this release's installer and README when checkpointed.

No migration.
No dependency changes.
No runtime UI rewrite was necessary.

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY.js

The installer runs:

node scripts/i3-ui-regression-audit.mjs
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

Successful audit includes:

I3 UI REGRESSION AUDIT PASSED

and ends with:

[I3] ALL VALIDATIONS PASSED

After I3 is checkpointed, the roadmap moves to the release-candidate audit.
