# Togetherly 1.14.3 — Everywhere + GitHub IPA Build

Togetherly is a private digital home for two people: connection, planning, long-distance context, memories and play, now extended to push notifications, Apple Watch and Lock Screen widgets.

## Stack

- Expo SDK 57 / React Native 0.86 / Expo Router / TypeScript
- Fastify API / PostgreSQL / WebSocket realtime
- Expo Notifications + Expo Push Service
- SwiftUI / WatchConnectivity / WidgetKit / App Intents for Apple Watch and widgets

## New in 1.14

- remote push while Togetherly is closed;
- Love Tap + Thinking of You;
- native Apple Watch companion;
- partner mood/status/local-time glance;
- Watch quick check-in + support acknowledgement;
- next-visit + Daily Question Watch state;
- interactive Watch complication and iPhone Lock Screen Love Tap;
- Partner and Next Visit complications/widgets;
- restricted, revocable Watch authentication.

## Start testing

Read **`EVERYWHERE_TEST_GUIDE.md` first**.

Root dependencies intentionally use `npm install` once for this test package because the new root lockfile could not be generated reliably in the packaging environment. The install creates a fresh lockfile on your machine.

```bash
npm install
npm --prefix server ci
docker compose up -d
npm run backend:migrate
npm run backend:dev
npm start
```

Latest migration: `012_push_watch_everywhere.sql`.

Detailed implementation notes: `V1_14_EVERYWHERE_NOTES.md`.

## GitHub → unsigned IPA → Sideloadly

For the Windows 7-day signing workflow, read **`GITHUB_IPA_BUILD.md`**. The repository includes `.github/workflows/build-unsigned-ipa.yml`, which compiles the iPhone/Watch build on GitHub's macOS runner and uploads unsigned IPAs for local Sideloadly signing.
