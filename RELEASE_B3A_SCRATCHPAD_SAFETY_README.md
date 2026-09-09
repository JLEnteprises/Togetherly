# Togetherly Release B3A — Scratchpad Collaboration Safety

This is a deliberately smaller B3 patch after B2.

## What it fixes

The Scratchpad already noticed when your partner edited it while you had local changes, but the server still accepted a later save and could overwrite the newer version.

B3A adds real optimistic concurrency:

- every Scratchpad save carries the `updated_at` version that was originally loaded;
- the server locks the Scratchpad row and rejects a stale save with HTTP 409;
- your local draft remains on-device when that happens;
- Save is disabled after a realtime partner update until you explicitly reload;
- Reload warns that it will discard your unsaved draft;
- **Clear all** drawings now requires destructive confirmation;
- **Undo mine** is labelled clearly so it is distinct from clearing the whole shared canvas.

No database migration is required.

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B3A_SCRATCHPAD_SAFETY.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B3A_SCRATCHPAD_AUDIT_REMAINING.txt` appears, send it before committing.

## Best two-device test

1. Open Scratchpad on both accounts.
2. Start typing on device A without saving.
3. Change and save the Scratchpad on device B.
4. Device A should show a partner-update warning and block Save.
5. Confirm Reload warns before discarding A's draft.
6. In drawing mode, tap Clear all and confirm the destructive prompt appears.
