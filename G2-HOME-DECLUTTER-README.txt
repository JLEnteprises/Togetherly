Togetherly v1.14.3 — Release G2: Home Declutter

Baseline
--------
Expected GitHub head before G2:
7391a7a2e79166e9d7dcb70f9164c17251072911
Add expandable hub foundation

What G2 changes
---------------
- Removes the generic "How I'm feeling" composer from Home.
- Keeps Love Tap and Thinking of You as compact immediate relationship actions.
- Removes permanent Play / Pick a Date / Save a Memory launchers from Home.
- Reuses the existing Home-layout slot as an "Active game" status that appears only when a game is already in progress.
- Turns routine Today rows into glanceable status instead of duplicate navigation entries.
- Keeps genuinely important Today moments actionable.
- Turns the long-distance Home card into status/information instead of a second Countdowns / Availability / Location menu.
- Updates Home Layout wording to match the new behavior.

Not included yet
----------------
G3 Together consolidation
G4 Plan expandable groups
G5 Us/story consolidation
G6 Composer sheets
H phases Photos
I phases Scratchpad

Install — Windows CMD
---------------------
Extract this ZIP into:
C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_G2_HOME_DECLUTTER.js

The installer automatically runs:
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

No migration is required.
Do not run expo lint.

Expected source files changed
-----------------------------
src/components/dashboard/HomeConnectionActions.tsx
src/components/dashboard/HomeQuickActions.tsx
src/components/dashboard/HomeTodayCard.tsx
src/components/dashboard/LongDistanceOverviewCard.tsx
src/app/features/home-layout.tsx

Checkpoint only after ALL VALIDATIONS PASSED.
