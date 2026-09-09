Togetherly v1.14.3 — Release D13: Live Game Rooms

Goal
Continue the roadmap’s partner-presence work from Shared Drawing into Games.

What changes
- Every game session now has its own ephemeral presence scope:
  game:<session id>
- Presence is exact to the current game. Being in a different game does not count as “here”.
- Adds a live game-room card beneath the game header.
- When your partner is in the same game:
  • LIVE GAME ROOM
  • Draw Together: “You both have the canvas open ♥”
  • Hangman: “You’re both watching the same puzzle ♥”
  • This or That: “You’re both in this round ♥”
  • Know Me: “You’re both in this question ♥”
  • Bingo: “You’re both in the same game room ♥”
- When your partner is elsewhere:
  • “Waiting for <partner> to open this game…”
- Finished/ended games accurately say the partner is not viewing the game rather than implying a live wait.

Accuracy
Presence means the partner has that exact game screen open.
It does not claim they are actively tapping, guessing, drawing, or answering unless the persisted game state proves it.

Also adjusts one Hangman sentence:
- from “Watch <partner>’s guesses appear live.”
- to “<partner>’s guesses will appear here as they play.”
This avoids implying they are currently present when they may not be.

Technical scope
- One screen only: src/app/features/games/[id].tsx
- Reuses D7/D12 presence infrastructure.
- No backend changes.
- No migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D13_LIVE_GAME_ROOMS.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
