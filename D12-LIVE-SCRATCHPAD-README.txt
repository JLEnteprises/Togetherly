Togetherly v1.14.3 — Release D12: Live Scratchpad

Goal
Start the roadmap’s “partner presence/activity in games, drawing and shared editing” work with the Shared Scratchpad / Drawing Canvas.

What changes
- Extends usePartnerPresence so callers can:
  • claim presence only while a shared surface is genuinely open
  • read the partner’s current ephemeral presence scope
- Shared Scratchpad now claims:
  • scratchpad:text
  • scratchpad:draw
- Full Scratchpad is live while open.
- Compact Home scratchpad only claims presence while expanded, so merely rendering Home does not falsely mark you as editing.
- When both partners have Scratchpad open, Togetherly can show:
  • “You’re both here”
  • “You and <partner> both have the drawing open ♥”
  • “You and <partner> both have the note open ♥”
  • “<partner> has the drawing open ♥”
  • “<partner> has the note open ♥”
- When alone, a quiet hint explains that live presence appears when both people open the scratchpad.

Important accuracy choice
This release says the partner “has the drawing/note open,” not “is drawing/typing,” because presence tells us the current surface but does not prove an active pen stroke or keystroke.

Safety / persistence
- Existing scratchpad conflict protection is untouched.
- Unsaved drafts are still protected from overwriting a partner’s newer save.
- Presence remains ephemeral and connection-only.
- No presence history is stored.

Database / dependencies
- No migration.
- No backend schema change.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D12_LIVE_SCRATCHPAD.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
