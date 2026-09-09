Togetherly v1.14.3 — Release G1
UI Hierarchy / Expandable Hub Foundation

BASELINE
91e81337262832fcfbf9a51f277efbaae2fe2b9f
Finish icon polish and accessibility

WHAT G1 DOES
- Adds src/components/navigation/ExpandableFeatureGroup.tsx
- Adds src/hooks/useExclusiveExpandedGroup.ts
- Provides compact title + live-summary/status presentation.
- Supports progressive disclosure for navigation rows and custom child content.
- Supports controlled or uncontrolled expanded state.
- Provides an exclusive-open helper for hubs that should keep only one major group open.
- Preserves Card participant identity semantics and existing E1-F3 visual/accessibility guardrails.
- Does NOT change Home, Together, Plan, Us or More yet.
- Does NOT change Photos, the database, migrations, or Scratchpad drawing.

INSTALL
Extract this ZIP into:
C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then in Windows Command Prompt:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION.js

The installer runs:
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

No migration is required.
Do not run expo lint.

CHECKPOINT AFTER "ALL VALIDATIONS PASSED"

git add src/components/navigation/ExpandableFeatureGroup.tsx src/hooks/useExclusiveExpandedGroup.ts APPLY_RELEASE_G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION.js G1-UI-HIERARCHY-EXPANDABLE-HUB-FOUNDATION-README.txt
git status
git commit -m "Add expandable hub foundation"
git push

Expected source changes for G1 are only:
- src/components/navigation/ExpandableFeatureGroup.tsx
- src/hooks/useExclusiveExpandedGroup.ts

The installer and this README are also intentionally checkpointed so the phase remains reproducible.
