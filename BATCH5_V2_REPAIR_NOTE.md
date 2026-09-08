# Batch 5 v2 repair installer

Use this after the original Batch 5 installer stopped part-way through `realtime.ts`.

It repairs the exact partial state produced by that installer, including the runtime-config timeout code that v1 accidentally skipped.

Run:

```cmd
node APPLY_BATCH5_V2.js
npm run typecheck
npm --prefix server run typecheck
```
