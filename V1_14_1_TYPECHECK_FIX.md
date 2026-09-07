# Togetherly v1.14.1 — Windows Typecheck Hotfix

This hotfix responds to the first real Expo SDK 57 client `npm run typecheck` run on Windows.

## Fixed

- Accept React Native `ColorValue` from Expo Router tab-bar icon callbacks.
- Add disabled-state support to the shared `IconButton` used by Home layout ordering.
- Add TypeScript-visible base modules for Metro platform files:
  - `PartnerMap` (`.native` / `.web`)
  - push notifications (`.native` / `.web`)
  - Watch bridge (`.ios` / `.android` / `.web`)
- Give push and Watch subscriptions explicit callback contracts, removing implicit-`any` errors.
- Preserve the platform-specific runtime implementations; the base modules exist so TypeScript and Metro agree on imports.
- Make Home partner-mood attention rendering null-safe.

## Re-test

From the project root after applying this hotfix:

```cmd
npm run typecheck
```

If that passes, continue with:

```cmd
npm run web
```
