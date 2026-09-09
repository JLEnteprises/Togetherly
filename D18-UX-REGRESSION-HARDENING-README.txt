Togetherly v1.14.3 — Release D18: UX Regression & Hardening

Purpose
This is the final definite release in the current UX roadmap.

D18 does not add another major feature. It regression-checks the product after D1–D17 and fixes shared infrastructure issues that affect many screens at once.

Fix 1 — Quick sheet mode regression
D8 moved create/edit flows into bottom sheets, but the shared CollapsibleComposer caption used:

  open ? QUICK EDIT : QUICK CREATE

Because the caption only exists while the modal is open, it always displayed QUICK EDIT — even when adding a brand-new item.

D18 now infers edit mode from edit-style sheet titles and displays:
- QUICK ADD for creation
- QUICK EDIT for editing

Fix 2 — Reduced motion consistency
Togetherly’s motion primitives already honour reduced motion, and ConfirmDialog already disables animation when reduced motion is enabled.

The following high-traffic overlays did not:
- shared quick add/edit sheet
- record view sheet
- Home/Together quick Mood sheet
- D9 celebration moment

D18 brings all four under the same reduced-motion preference.

CelebrationMoment now:
- skips the scale/spark animation when reduced motion is enabled
- renders immediately at its final state
- uses no Modal fade animation
- keeps the celebration content and auto-dismiss behavior

Fix 3 — Record-view instruction
The footer language is simplified from:
“Use ••• on the item card to edit, manage or delete it.”

to:
“Close this view, then use ••• on the card for any edit or delete options.”

This matches the interaction rule established across the roadmap:
- tap = view
- ••• = available record actions

Final source-level regression audit
The installer verifies that the completed roadmap anchors have not regressed, including:
- five-tab structure: Home / Plan / Together / Us / More
- Home Right now / Between you / Life today hierarchy
- Together presence + unified connection actions
- no duplicate old ConnectionPingsCard on Together
- shared Scratchpad presence
- exact game-room presence
- shared Note view/edit presence
- story-led Us tab
- lighter Plan hierarchy
- Trip Hub
- living Countdowns
- mutual Date Idea match state
- shared Decision Wheel presence/integration
- corrected quick add/edit labels
- reduced-motion coverage on shared overlays

Validation
D18 deliberately adds one validation that previous releases did not run:

- frontend TypeScript
- frontend lint
- server TypeScript
- server logic smoke checks
- D18 source-level UX regression audit

No migration.
No backend schema change.
No new dependency.

Apply
1. Extract into:
   C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

2. Run:
   node APPLY_RELEASE_D18_UX_REGRESSION_HARDENING.js

What happens next
If all D18 checks pass, the current UX roadmap is complete.

A D19 should only be created if D18 surfaces an actual regression or lint/type/runtime issue that needs a targeted repair. It should not exist just to keep the release sequence going.
