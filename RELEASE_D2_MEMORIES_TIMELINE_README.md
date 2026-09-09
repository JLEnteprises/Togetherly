# Togetherly Release D2 — Memories & Timeline Visual Overhaul

D2 turns Memories from a mostly record/card view into a more story-led experience without changing the data model.

## Memories

- newest memories are shown first;
- raw `YYYY-MM-DD` dates become human-readable dates;
- multi-photo memories show their photo count;
- the page copy is framed around the relationship story rather than record management.

## Timeline

The old timeline was a compact vertical list with text-only milestones.

D2 changes it into year-based story chapters:

- year headings;
- photo-led milestone cards;
- relationship-start marker remains supported;
- milestone photo counts;
- creator attribution and identity colour remain visible;
- tapping a real milestone opens the same full Memory detail experience;
- a story summary shows how many photo-backed milestone moments you have.

## Memory detail

The Memory sheet now behaves more like opening a saved moment:

- full-width photo hero;
- friendly date;
- stronger title/story hierarchy;
- story text has its own reading surface;
- photo count and milestone/tags remain visible;
- full-screen lightbox is preserved.

## Apply

No migration is required.

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_D2_MEMORIES_TIMELINE.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_D2_MEMORIES_TIMELINE_AUDIT_REMAINING.txt` appears, send it before committing.
