Togetherly v1.14.3 — Release D7: Live Partner Presence

Goal
Make shared spaces feel occupied by two real people instead of silently realtime-syncing in the background.

Adds
- Ephemeral realtime presence over the existing authenticated WebSocket.
- “<Partner> is here ♥” when both partners are on the same shared screen.
- “Waiting for <Partner>…” when only one partner is there.
- Presence first wired into:
  • Date Ideas
  • Decision Wheel
  • the same Trip Hub
- Presence disappears automatically when a screen unmounts, the app disconnects, or the socket closes.

Privacy / persistence
- Presence is connection-only.
- No database table.
- No presence history.
- No migration.
- No new dependency.

Apply
1. Extract this package into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D7_LIVE_PARTNER_PRESENCE.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
