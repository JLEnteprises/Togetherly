Togetherly v1.14.3 — Release D14: Live Shared Notes

Goal
Finish the first shared-editing presence pass by making Shared Notes feel co-present without weakening privacy or save safety.

What changes
- Shared note presence is record-specific:
  note:<note id>:view
  note:<note id>:edit
- Opening one shared note does not make you appear present in another.
- Editing one shared note does not make you appear present in another.
- Togetherly can distinguish whether your partner:
  • has the same shared note open
  • is editing the same shared note
- When you meet in the same note:
  • “YOU’RE BOTH IN THIS NOTE”
  • “<partner> has this shared note open ♥”
  • “<partner> is editing this shared note ♥”

Privacy rules
- Private notes never claim note presence.
- New unsaved notes never claim note presence.
- A stored shared note only claims edit presence while its current editor visibility remains Shared.
- If you switch a shared note toward Private before saving, presence stops locally rather than broadcasting continued collaboration.

Save safety
- Existing note update/version handling remains unchanged.
- D14 does not turn Notes into character-by-character collaborative editing.
- Presence is ephemeral only; no history is stored.

Technical scope
- src/app/features/notes.tsx only.
- Reuses D12 presence infrastructure.
- No backend changes.
- No migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D14_LIVE_SHARED_NOTES.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
