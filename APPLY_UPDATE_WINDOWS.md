# Togetherly v1.14 — Windows Setup / Validation

This is the **Togetherly Everywhere test source package**. It contains the Expo SDK 57 phone app, Fastify/PostgreSQL server, remote push source, native SwiftUI Apple Watch target, Watch complication/widget target, and iPhone WidgetKit target. It is not a pre-signed IPA.

For the full push/Watch walkthrough, use **`EVERYWHERE_TEST_GUIDE.md`**. This file is the short Windows path.

## 1. Install dependencies

The root v1.14 lockfile is intentionally regenerated on your machine because v1.14 adds native packages that could not be fetched reliably in the packaging environment:

```cmd
npm install
npm --prefix server ci
```

After that first `npm install`, keep the newly generated root `package-lock.json` and use `npm ci` normally.

## 2. Configure environment

```cmd
copy .env.example .env
copy server\.env.example server\.env
```

Set at minimum:

```text
EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:4000
EXPO_PUBLIC_EAS_PROJECT_ID=<your EAS project UUID>
EXPO_PUBLIC_IOS_BUNDLE_ID=com.yourname.togetherly
EXPO_PUBLIC_ANDROID_PACKAGE=com.yourname.togetherly
EXPO_PUBLIC_APPLE_TEAM_ID=<10-character Apple Team ID>
```

In `server\.env`, set a strong `JWT_SECRET` and the correct `DATABASE_URL`.

## 3. Database + server

```cmd
docker compose up -d
npm run backend:migrate
npm run backend:typecheck
npm --prefix server run build
npm run backend:dev
```

Latest migration: **`012_push_watch_everywhere.sql`**.

## 4. Client checks

```cmd
npm run typecheck
npm run web
```

For phone-only development you can also use the normal Expo development workflow. **Remote push and the Apple Watch/widgets are native features and should be tested in a signed development build, not treated as an Expo Go test.**

## 5. Signed iPhone + Watch test

From Windows, follow `EVERYWHERE_TEST_GUIDE.md` for EAS setup and then create the iOS development build:

```cmd
eas build --platform ios --profile development
```

The native target source lives under `targets/` so it survives clean Expo prebuilds.

## 6. Two-account acceptance test

With two linked accounts verify:

1. Enable push on both physical phones and use **Send test**.
2. Love Tap and Thinking of You reach the partner as in-app + remote notifications.
3. Daily Question, Mood/check-in and planning notifications obey category preferences.
4. Signing out stops that device receiving the signed-out account's pushes.
5. Open Togetherly on iPhone once, then open the Watch companion and confirm partner status/local time.
6. Send Love Tap and Thinking of You from Watch.
7. Quick check-in on Watch reaches the partner.
8. `I'm here` acknowledgement works from Watch when the partner has a shared need.
9. Next Visit / relationship days and Daily Question state match the phone.
10. Add Partner / Love Tap / Next Visit complications and the iPhone Lock Screen widgets; test the interactive Love Tap.
11. Retest v1.13 Home, Plan, Together, Us, Memories, games, location privacy and Reduced Motion.

## Important local-network note

A Watch making its **own** network request may reject a plain LAN `http://` API under App Transport Security. The Watch implementation therefore also has a paired-iPhone fallback. Use a real **HTTPS** API endpoint to validate independent Wi-Fi/cellular Watch actions.
