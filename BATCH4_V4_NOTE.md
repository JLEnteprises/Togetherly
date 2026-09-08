# Batch 4 v4

This version is intentionally ASCII-only so Windows PowerShell 5.1 cannot corrupt curly apostrophes, en dashes, or comparison symbols while parsing the script.

It also uses targeted regex matching and skips already-applied fixes where possible.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_BATCH4_WINDOWS_V4.ps1
```

Then:

```cmd
npm run typecheck
npm --prefix server run typecheck
```
