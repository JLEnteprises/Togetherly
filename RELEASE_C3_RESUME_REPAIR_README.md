# Togetherly C3 Resume Repair

The original C3 installer stopped after it had already created migration 015, added the shared-day utility, updated the TypeScript types/API, and changed the Date Ideas filter/import.

It failed because the helper insertion matched the whole one-line `toggleInterest()` function exactly, while your current file formatting differed slightly.

This repair resumes from that exact partial state and uses stable function markers instead.

## Do not rerun the original C3 installer.

Extract this ZIP into the project root, then run:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_C3_RESUME_REPAIR.js
npm.cmd run backend:migrate
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_C3_RESUME_AUDIT_REMAINING.txt` appears, send it before committing.
