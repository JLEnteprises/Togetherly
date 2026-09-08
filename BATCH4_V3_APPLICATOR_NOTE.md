# Batch 4 v3 applicator

This installer replaces the brittle exact-text matching used by Batch 4 v2 with targeted, idempotent regex/function-level patches.

It is safe to run after the v2 installer failed on its first Activities block. Already-applied Batch 4 changes are detected and skipped where possible.

After applying:

```cmd
npm run typecheck
npm --prefix server run typecheck
```
