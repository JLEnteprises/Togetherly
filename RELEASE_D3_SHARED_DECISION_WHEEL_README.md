# Togetherly Release D3 — Shared Animated Decision Wheel

The old Decision Wheel looked like a wheel feature, but it was actually local-only:

- options existed only on one phone;
- `Math.random()` chose a winner locally;
- history disappeared when the screen closed;
- the partner did not receive the same spin;
- there was no actual wheel animation.

D3 turns it into a real shared couple interaction.

## Shared state

- Options are stored once for the couple.
- Saving options updates the other phone through Togetherly realtime.
- Spins are server-authoritative.
- The server uses Node's cryptographic `randomInt()` to choose the winner.
- Both phones receive the same `spin_id`, winner, winner index and timestamp.
- The five most recent spins are persisted with who spun them.

## Actual wheel

The screen now renders a real segmented wheel using `react-native-svg` (already in the project).

When a new shared spin arrives:

- the wheel performs five full rotations;
- it lands the winning segment under the pointer;
- a partner-triggered spin animates on the other phone too;
- reopening the screen restores the last landed position without replaying the animation.

The wheel deliberately uses neutral Togetherly UI colours rather than participant colours because wheel segments are choices, not people.

## Migration required

D3 adds `017_shared_decision_wheel.sql`.

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_D3_SHARED_DECISION_WHEEL.js
npm.cmd run backend:migrate
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_D3_SHARED_WHEEL_AUDIT_REMAINING.txt` appears, send it before committing.

## Manual two-phone test

1. Open Decision Wheel on both phones.
2. Enter 3+ options on one phone and Save.
3. Confirm the other phone updates.
4. Spin on phone A.
5. Both phones should animate to the same result.
6. Spin on phone B.
7. Both phones should again land on the same result.
8. Reopen the screen and confirm the recent shared spin history remains.
