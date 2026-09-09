# Togetherly B2 Repair 2

The previous resume patch stopped after it had already:

- changed the Date Idea title prompt;
- replaced the old Cost/Where block with `DetailsToggle`.

That left Cost/Where temporarily absent from the Date Idea form.

This patch is designed specifically for that partial state. It inserts Cost and Where into the advanced details section, then finishes the remaining B2 work on Lists, Countdowns and Notes.

Do not rerun either earlier B2 installer first.

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B2_REPAIR2.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B2_REPAIR2_AUDIT_REMAINING.txt` appears, send it before committing.
