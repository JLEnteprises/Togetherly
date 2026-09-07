# Togetherly v1.14 — Static / Build Validation Report

Generated for the **Everywhere test package** on 8 September 2026.

## Passed in the packaging environment

- **161** `.ts` / `.tsx` source files parsed with the TypeScript compiler parser: **0 syntax errors**.
- All local client aliases and relative TypeScript/TSX imports resolve to existing source/platform files.
- Server NodeNext `.js` source specifiers resolve to their TypeScript counterparts.
- **6** Swift source files parse with Swift 6.2: **PASS**.
- Apple target configs evaluate successfully as `watch`, `watch-widget`, and `widget` and inherit one shared App Group.
- Root `package.json`, `app.json`, `eas.json`, server package/lock and local Expo-module config parse as valid JSON.
- Root/app/server versions are all **1.14.0**.
- Server TypeScript typecheck: **PASS**.
- Server production TypeScript build: **PASS**.
- Fastify app construction/route registration: **PASS**, including `/watch/*`, `/notifications/push/*`, and `/relationship-pings`.
- Pure date/calendar/task logic smoke checks: **PASS**.
- Source merge-conflict markers: **none**.

## Deliberately not claimed here

The packaging environment is Linux and cannot link/sign watchOS or WidgetKit targets. The authoritative native Apple validation is therefore the EAS/Xcode build and physical iPhone + Apple Watch test described in `EVERYWHERE_TEST_GUIDE.md`.

The full root/client `npm run typecheck` also still needs to be rerun after `npm install` on the development machine because the packaging environment could not reliably download the newly added v1.14 npm dependencies. The stale v1.13 root lockfile is intentionally **not** shipped.

The database-backed two-account `server smoke` test requires the configured PostgreSQL instance and should be run during local testing.
