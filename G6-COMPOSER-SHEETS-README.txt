Togetherly v1.14.3 — Release G6: Composer Sheets

Verified baseline
-----------------
GitHub head:
a472f924d6d41d5f76d2cd8389012f284093f129

G5 was verified as one clean commit above G4 with exactly the intended G5 files.

Why G6 is smaller than the original handoff expected
----------------------------------------------------
The current CollapsibleComposer implementation has already evolved into a real bottom-sheet Modal:
- page content stays stable
- keyboard avoidance
- scrollable form content
- backdrop close
- explicit close button
- reduced-motion support

So G6 does NOT rebuild working forms.

What G6 changes
---------------
1. Adds an explicit shared primitive:
   src/components/common/ComposerSheet.tsx

2. Makes CollapsibleComposer a compatibility wrapper around ComposerSheet.
   This removes duplicated sheet implementation and lets any older call sites keep working.

3. Migrates the major create/edit flows named by the redesign to ComposerSheet:
- Tasks
- Calendar events
- Notes
- Lists
- Goals
- Trips
- Countdowns
- Memories
- Date Ideas
- Albums

4. Moves album editing out of the album card and into a headless ComposerSheet.
   The album page no longer expands downward while editing the album name/description.

ComposerSheet supports:
- normal launcher-card mode
- showLauncher={false} for edit flows launched elsewhere
- modal presentation
- keyboard-safe layout
- scrollable long forms
- close/backdrop behavior
- existing advanced DetailsToggle sections inside the sheet

Files changed
-------------
src/components/common/ComposerSheet.tsx
src/components/common/CollapsibleComposer.tsx
src/app/features/tasks.tsx
src/app/features/calendar.tsx
src/app/features/notes.tsx
src/app/features/lists.tsx
src/app/features/goals.tsx
src/app/features/trips.tsx
src/app/features/countdowns.tsx
src/app/features/memories.tsx
src/app/features/activities.tsx
src/app/features/photos.tsx

No form data model, API, or save logic is changed.

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G6_COMPOSER_SHEETS.js

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
- completed E1–F3 and G1–G5 markers are checked before writes
- every modified output is prepared before any source file is written
- CRLF/LF style is preserved per file
- an unrelated pre-existing ComposerSheet.tsx is never overwritten
- installer is safe to run twice

Checkpoint only after:
[G6] ALL VALIDATIONS PASSED
