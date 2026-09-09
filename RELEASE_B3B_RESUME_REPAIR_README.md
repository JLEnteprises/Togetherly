# Togetherly B3B Resume Repair

The original B3B installer stopped after partially completing Date Ideas.

The cause was simple: the installer expected the existing confirmation dialog to say **Delete idea?**, while the actual source says **Delete activity?**. Everything before that point had already been written.

This repair is built specifically for that partial state. It:

- verifies Tasks, Notes, Countdowns and Date Ideas already contain the earlier B3B changes;
- adds the missing Date Idea detail sheet using a stable insertion point;
- completes Goals;
- completes Calendar;
- runs a full B3B interaction audit.

Do **not** rerun the original B3B installer first.

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B3B_RESUME_REPAIR.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B3B_RESUME_AUDIT_REMAINING.txt` appears, send it before committing.
