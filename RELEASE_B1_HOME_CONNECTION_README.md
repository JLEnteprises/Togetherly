# Togetherly Release B1 — Home & Connection

This is the first Core UX pass after the identity system.

## Changes

- Adds a permanent **Connect** area on Home when a partner is linked.
- Love Tap is now a one-tap Home action.
- Thinking of You is now a one-tap Home action.
- Adds a fast Home **Check in** bottom sheet for Mood + Need + Shared/Private.
- Uses participant identity cues without turning generic Togetherly controls into participant colours.
- Home Today now shows **one priority relationship card** instead of treating every row equally:
  1. partner needs support
  2. Daily Question ready to reveal
  3. unanswered Daily Question
- Calendar / Tasks / Mood remain lightweight rows underneath.
- "Do something" quick actions are calmer, more descriptive, and less dashboard-like.
- Reduces unnecessary all-caps styling on the Home greeting/weekday.
- No database migration and no backend changes.

## Apply

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B1_HOME_CONNECTION.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If all pass, test Home with both accounts:
- send Love Tap
- send Thinking of You
- quick shared Mood check-in
- quick private Mood check-in
- partner mood needing support
- Daily Question before answering and when both answers are ready
