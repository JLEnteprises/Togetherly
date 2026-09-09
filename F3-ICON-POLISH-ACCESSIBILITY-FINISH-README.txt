Togetherly v1.14.3 — F3: Icon, Polish & Accessibility Finish
==============================================================

Purpose
-------
F3 is the final polish/accessibility pass after F1 first-time guidance and F2 empty-state coaching.
It intentionally changes shared interaction primitives instead of feature behaviour.

What changes
------------
1. IconButton
   - Uses a true 44 x 44 touch target.
   - Keeps explicit accessibility labels and disabled state.
   - Adds optional accessibilityHint support.
   - Adds a small hitSlop safety margin.

2. AppButton
   - A button without an onPress handler is now correctly exposed as disabled.
   - Disabled styling and accessibility state use the same source of truth.

3. ChoiceChips
   - Single-choice chips expose radio semantics and checked state to assistive technology.
   - Visual behaviour is unchanged.

4. ProgressBar
   - Announces a progressbar role and numeric 0–100 value.
   - Optional label prop defaults to "Progress".

5. Primary tabs
   - Home, Plan, Together, Us and More receive explicit stable screen-reader labels.

Not changed
-----------
- No database migration.
- No server/API behaviour changes.
- No dependency changes.
- No participant-colour/identity changes.
- No feature workflow changes.
- No version bump.

Windows / Command Prompt
------------------------
Extract this ZIP into the Togetherly project root, then run:

  cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
  node APPLY_RELEASE_F3_ICON_POLISH_ACCESSIBILITY_FINISH.js

The installer automatically runs the trusted checks:

  npm.cmd run typecheck
  npm.cmd --prefix server run typecheck
  npm.cmd --prefix server run logic

Do NOT run expo lint. Expo 54 + ESLint 9 may show a misleading bootstrap prompt.

Safety
------
- CRLF/LF is detected per file and preserved.
- All patch outputs are precomputed before any source file is written.
- Re-running the installer is idempotent.
- E1, E2, E3, E4, F1 and F2 markers are audited before validation completes.

Expected finish
---------------
  [F3] ALL VALIDATIONS PASSED
