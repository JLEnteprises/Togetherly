# Togetherly C3 — Final Randomizer Repair

Migration 015, server typecheck, and logic tests already passed.

The only remaining C3 issue is one stale button line in
`src/app/features/activity-randomizer.tsx`. The earlier repair successfully
created `toggleFavourite()` but its exact button replacement missed because the
existing source contains mojibake/encoding characters in the star labels.

This repair finds the stale button structurally instead of matching the visible
star characters.

Run:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_C3_RANDOMIZER_FINAL_REPAIR.js
npm.cmd run typecheck
```

No migration rerun is needed.
