# Batch 3 v3 applicator note

This v3 installer is idempotent and is designed for the partially-applied state produced when Batch 3 v2 patched the Daily Question block and then stopped on the Mood acknowledgement block.

Changes are applied by endpoint/function-level regex matching rather than brittle exact multiline matching.

It safely skips any Batch 3 change already present, then applies the remaining Daily Question, Mood and Notifications fixes.

After applying:

```cmd
npm run typecheck
npm --prefix server run typecheck
```
