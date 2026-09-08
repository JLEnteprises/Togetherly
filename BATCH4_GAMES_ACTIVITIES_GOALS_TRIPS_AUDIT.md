# Togetherly Batch 4 — Games, Activities, Randomiser, Goals & Trips

Audited against the current `JLEnteprises/Togetherly` main branch on 2026-09-08.

## Activity ideas
- Backend allows activity durations from 1 to 1,440 minutes.
- UI now enforces the same limit before sending the request.
- Existing create/edit, interest voting, planning into Calendar, tags, status changes and realtime refresh were reviewed.

## Activity randomiser
- Fixed misleading `1–3h` filter label. The backend implements this control as `maxMinutes <= 180`, so the honest label is now `≤3h`.
- Added busy guards to reroll / Not tonight / favourite / plan actions to prevent overlapping requests and accidental duplicate actions.
- `Not tonight` continues to use the existing seven-day rejection cooldown on the backend.

## Goals
- Found a real correction-history bug: a goal at 10 corrected by -100 stored a -100 contribution but clamped current value to 0. Contribution totals could then disagree with the displayed goal total.
- Backend now stores only the effective negative correction (in that example, -10).
- Paused goals no longer invite adding progress from the card.
- A manually completed goal below 100% now says `Goal marked complete`; `Goal reached` is reserved for a numerical target that has actually been reached.
- Existing automatic completion, reopening after a negative correction, per-user contribution history, tags and realtime updates were reviewed.

## Trips
- Linked countdown dates in Trip Detail now use date-only extraction instead of timezone-sensitive `toLocaleDateString()` on the raw timestamp.
- Quick-create countdown no longer sends a `startAt` that is equal to or later than the target when the trip starts today / target instant has already passed.
- Existing trip date validation, quick packing list, quick calendar event, linking/unlinking Lists/Goals/Countdowns/Events and ownership checks were reviewed.

## Games
Reviewed:
- Relationship Bingo permissions / confirmation flow / win detection
- Hangman secret visibility and guess permissions
- This or That hidden-answer reveal
- How Well Do You Know Me subject-first locking and scoring
- Draw Together action permissions / stroke limits
- Recent/active game navigation

The drawing and Hangman presentation changes remain in Batch 1, so this batch does not overwrite those files.

## Verify
Run:

```cmd
npm run typecheck
npm --prefix server run typecheck
```

Manual checks:
1. Activity duration 1441 -> blocked client-side.
2. Randomiser ≤3h can return a 30/60/120/180-minute activity; label no longer claims a minimum of 1 hour.
3. Rapidly tap reroll / Not tonight -> only one request chain should run.
4. Goal current=10, add -100 -> goal becomes 0 and history records -10, not -100.
5. Pause a goal -> Add progress control disappears; resume restores it.
6. Manually complete a 50% goal -> text says Goal marked complete.
7. Create a Trip beginning today -> quick Countdown should not fail with "Starting date must be before target date".
8. View a linked countdown from different phone timezones -> date display should remain date-oriented.
