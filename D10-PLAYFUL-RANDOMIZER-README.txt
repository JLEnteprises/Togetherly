Togetherly v1.14.3 — Release D10: Playful Randomizer

Goal
Turn the Activity Randomizer from a filter/query screen into a tiny couple ritual.

What changes
- Adds live partner presence to the randomizer.
- Reframes the screen around “Pick something for us”.
- Keeps all existing filters and backend selection logic.
- Adds a short, intentional suspense phase before the reveal.
- Adds orbit/spark motion while ideas are being mixed.
- Adds a spring reveal for the chosen activity.
- Makes the result language more conversational:
  “OKAY, THIS ONE ♥”
- Reroll becomes “Pick again”.
- Keeps Let’s do it, Not tonight, favourite, filtering and rejection behaviour intact.
- Respects reduced-motion settings: the forced suspense delay and looping animation are skipped when reduced motion is enabled.

Technical scope
- One screen only: src/app/features/activity-randomizer.tsx
- Uses existing React Native Animated + Togetherly motion/art components.
- No backend change.
- No migration.
- No dependency.

Apply
1. Extract this package into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D10_PLAYFUL_RANDOMIZER.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
