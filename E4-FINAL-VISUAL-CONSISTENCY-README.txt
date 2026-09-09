Togetherly v1.14.3 — Release E4: Final Visual Consistency

What this release does
----------------------
E4 is the final visual consistency pass for the E-series identity work.
It does not add new relationship features or alter stored data.

This release:
- adds one shared EyebrowText primitive so page headers, detail headers,
  and grouped navigation use the same uppercase/tracking treatment;
- gives PageHeader a consistent eyebrow/title rhythm;
- makes BackHeader use the same eyebrow styling as top-level pages;
- normalizes FeatureGroupCard row height, icon wells, icon colour,
  pressed treatment, and title hierarchy;
- gives SectionHeader actions a consistent 44px touch target and
  soft pressed affordance;
- preserves E1 shared/Ours identity, E2 personal colour identity,
  and E3 paired couple identity.

No migration.
No dependency changes.
No version bump.
Do not run expo lint for this release.

Install
-------
1. Extract this ZIP into:
   C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

2. From the project root run:
   node APPLY_RELEASE_E4_FINAL_VISUAL_CONSISTENCY.js

The installer automatically runs:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

The installer is idempotent and can safely be run twice.
It detects CRLF/LF per file, patches using normalized LF in memory,
and restores the original line-ending style.

Checkpoint after success (Command Prompt)
-----------------------------------------
git add APPLY_RELEASE_E4_FINAL_VISUAL_CONSISTENCY.js E4-FINAL-VISUAL-CONSISTENCY-README.txt src/components/common/EyebrowText.tsx src/components/common/PageHeader.tsx src/components/common/BackHeader.tsx src/components/common/SectionHeader.tsx src/components/navigation/FeatureGroupCard.tsx
git commit -m "Finish visual consistency pass"
git push
