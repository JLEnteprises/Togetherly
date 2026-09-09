# Togetherly Release B3B — View vs Manage Interaction

B3B standardises the interaction rule:

**Tap the item = open/view it.**  
**••• = edit/manage/delete it.**

## Changed

- Tasks: tapping the task body opens a read-only detail sheet; ••• edits/deletes.
- Notes: tapping opens the note; each note now has ••• for edit/delete.
- Countdowns: tapping the title/date opens details; ••• edits/deletes.
- Date Ideas: tapping the title/description opens details; Interested and Plan remain direct actions; ••• manages.
- Goals: tapping the title/description opens details; Add progress remains a direct action; ••• manages.
- Calendar: tapping an event opens details; ••• edits/deletes.
- Search/deep-link convention is also cleaned up:
  - `?focus=<id>` = view/open
  - `?edit=<id>` = explicitly enter edit mode

Memories already follow this model through `MemoryDetailModal`; Lists already open their list screen; Trips already open `trip-detail`, so B3B leaves those alone.

No database migration and no backend changes.

## Before applying

B3A passed. Checkpoint it first:

```cmd
git add .
git commit -m "Protect shared scratchpad from conflicting edits"
git push
```

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B3B_VIEW_MANAGE.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B3B_VIEW_MANAGE_AUDIT_REMAINING.txt` appears, send it before committing.
