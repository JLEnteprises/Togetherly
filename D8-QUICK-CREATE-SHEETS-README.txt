Togetherly v1.14.3 — Release D8: Quick Create Sheets

Goal
Make create/edit flows feel fast and mobile-native instead of expanding large forms inline into the page.

What changes
- Upgrades the shared CollapsibleComposer interaction used throughout Togetherly.
- Closed state remains a compact, familiar + action.
- Tapping it now opens the existing form in a slide-up bottom sheet.
- The current screen stays visible behind the dimmed overlay.
- Tap outside or the close button to dismiss.
- Sheet content scrolls independently.
- Keyboard avoidance is built in for iOS.
- Existing form fields, validation, edit state, advanced-details toggles, save handlers and backend calls are untouched.

Why this is broad but safe
The public CollapsibleComposer API is unchanged. Existing screens do not need to be rewritten:
- Tasks
- Date Ideas
- Trips
- Goals
- and other screens already using the shared composer inherit the new interaction automatically.

Database
- No migration.
- No new dependency.

Apply
1. Extract this package into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D8_QUICK_CREATE_SHEETS.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
