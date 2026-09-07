# Togetherly v1.14 — Push + Apple Watch Test Guide

This is a source test package, not a pre-signed IPA. The phone app can still be developed normally on Windows. Apple Watch/widgets require an Apple-signed iOS native build, which can be produced through EAS cloud builds from Windows or locally on a Mac with Xcode.

## A. Install + database

From the extracted folder:

```cmd
npm install
npm --prefix server ci
docker compose up -d
copy server\.env.example server\.env
copy .env.example .env
```

Set a real `JWT_SECRET` in `server\.env` and configure `DATABASE_URL` if needed.

For a physical phone on your LAN, set:

```text
EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:4000
```

Then:

```cmd
npm run backend:migrate
npm run backend:typecheck
npm --prefix server run build
npm run backend:dev
```

Migration `012_push_watch_everywhere.sql` must be applied before testing push/Watch features.

## B. Configure EAS + push

You need an Expo account. For an Apple-signed Watch build you also need an Apple Developer Program team.

1. Install/login to EAS:

```cmd
npm install -g eas-cli
eas login
```

2. Initialise/link the project:

```cmd
eas init
```

Copy the resulting EAS project UUID into `.env`:

```text
EXPO_PUBLIC_EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

3. Set a bundle identifier you control and your 10-character Apple Team ID:

```text
EXPO_PUBLIC_IOS_BUNDLE_ID=com.yourname.togetherly
EXPO_PUBLIC_ANDROID_PACKAGE=com.yourname.togetherly
EXPO_PUBLIC_APPLE_TEAM_ID=ABCDEFGHIJ
```

The config automatically derives the shared Apple App Group as:

```text
group.com.yourname.togetherly.shared
```

4. Let EAS configure Apple push credentials when prompted during your first signed iOS build. Expo Push Service uses those credentials to deliver APNs notifications.

## C. Build iPhone + Watch from Windows using EAS

A development/internal build is the easiest first physical-device test:

```cmd
eas build --platform ios --profile development
```

Register the iPhone as requested by EAS. The native build includes:
- Togetherly iPhone app;
- Togetherly Watch companion;
- Watch complication/widget extension;
- iPhone WidgetKit extension.

If the Apple-target generator reports a native-target issue, use a Mac/Xcode for the first native diagnosis; the Swift source and target configs are deliberately kept outside generated `ios/` so fixes survive prebuild.

## D. Mac/Xcode alternative

Requirements: macOS 15+, Xcode 16+, CocoaPods 1.16.2+.

```bash
npm install
npx expo prebuild -p ios --clean
open ios/*.xcworkspace
```

In Xcode confirm the same Apple Team and App Group capability on the main app, Watch app and widget targets, then build/run on the paired iPhone + Watch.

## E. Push test

With two linked Togetherly accounts on two physical devices:

1. Settings → Notifications → **Enable push** on both devices.
2. Press **Send test** and confirm the banner arrives while Togetherly is backgrounded.
3. On Account A send **Love Tap** from Together.
4. Account B should receive an in-app notification and remote push.
5. Tap the push and confirm Togetherly opens the relevant Together screen.
6. Send Daily Question/check-in/task events and confirm category preferences suppress only the categories you disable.
7. Sign Account B out and confirm that device no longer receives Account B's pushes.

Remote push requires a physical device; Expo Go is not the authoritative test path for this build.

## F. Apple Watch test

1. Install the EAS/Xcode Togetherly build on the paired iPhone. The Watch companion should become available/installable in the Watch app.
2. Open Togetherly once on iPhone while signed in. This provisions the restricted Watch token and syncs partner state.
3. Open Togetherly on Watch. Confirm partner name, local time and status appear.
4. Tap **Send love**. Confirm the partner receives the Love push.
5. Tap **Thinking of you** and verify the lighter signal.
6. Use **Quick check-in**; confirm the partner sees the mood/need.
7. If the partner has a shared mood need, tap **I'm here** and verify their acknowledgement notification.
8. Confirm Daily Question state and Next Visit/relationship fallback are correct.

For LAN `http://` development APIs, direct Watch network requests may be blocked by watchOS App Transport Security; the Watch then falls back through the paired iPhone. Use a real **HTTPS** API to validate independent Wi-Fi/cellular Watch actions.

## G. Complications / Smart Stack / Lock Screen

On Apple Watch, add Togetherly complications/widgets:
- **Partner** — mood/status + partner local time;
- **Love Tap** — interactive heart;
- **Next Visit** — countdown.

Also add Togetherly to the Watch Smart Stack where offered by watchOS.

On iPhone Lock Screen, add:
- **Togetherly Partner**;
- **Love Tap**.

Tap the Love complication/widget and confirm a partner notification is produced without opening the full app.

## H. Regression checks

Also retest v1.13 basics: Home, Daily Question reveal/lock, Mood privacy, invite/share, location sharing/logout, Memories, Date Ideas, games and Reduced Motion.
