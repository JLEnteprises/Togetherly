# Togetherly Release B2 — Fast Create & Less Admin

This pass makes creation feel lighter without removing any advanced capability.

## Main rule

**Create the thing first. Add metadata only when you want it.**

## Changes

- Adds one consistent `DetailsToggle` used across creation flows.
- **Tasks:** title + who is doing it first; dates, duration, priority, repeat, steps and tags stay behind “Add dates & details”.
- **Memories:** title + date + photos first; story, place, icon, milestone and tags move behind “Add the story & details”.
- **Date Ideas:** only the idea title is required up front; cost/location/mood/duration/etc. are optional details.
- **Lists:** list title first; tags are hidden unless wanted.
- **Countdowns:** title + target date first; start date and countdown type become optional details.
- **Notes:** title + body first; privacy, tags and pinning become optional details.
- Fixes the Notes UI mismatch: when editing your partner’s shared note, the UI no longer offers “Private”, matching the server rule.
- Replaces several administrative ALL-CAPS labels with conversational prompts.
- No database migration and no backend behaviour changes.

## Before applying

B1 passed, so checkpoint it first:

```cmd
git add .
git commit -m "Redesign Home around connection and priorities"
git push
```

Then apply B2:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B2_FAST_CREATE.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B2_FAST_CREATE_AUDIT_REMAINING.txt` appears, send it before committing.
