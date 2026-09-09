# Release A Identity Cleanup

The Release A scan found only two remaining React Native source files with legacy Purple/Green assumptions:

- `src/app/features/games/[id].tsx`
- `src/components/common/CosmicBackdrop.tsx`

This cleanup removes both.

## Changes

### Draw Together
The drawing colour resolver now treats any `#RRGGBB` participant colour as a valid identity colour. Only the special `both` value falls back to neutral text.

### Cosmic Backdrop
The backdrop no longer has hard-coded Purple/Green. It uses the current couple's chosen colours only as faint ambient hints. Normal Togetherly controls remain neutral.

The cleanup reruns the legacy-colour scan. If it succeeds, `RELEASE_A_IDENTITY_REMAINING.txt` is removed.

## Run

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_A_IDENTITY_CLEANUP.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd run backend:migrate
```
