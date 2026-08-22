# Togetherly v1.11 — Apply & Test on Windows

v1.11 is a polish and hardening update on top of v1.10. It keeps every existing feature, adds no new npm dependency, and adds no database migration. Migration `011_live_location.sql` remains the latest migration.

## 1. Stop Togetherly

Press `Ctrl+C` in the Expo and backend terminals. Docker Desktop / PostgreSQL can stay running.

## 2. Apply the overlay

Extract `Togetherly-v1.11-Polish-Hardening-Overlay.zip` and copy the **contents** of its folder over both projects, choosing **Replace files in destination**.

Real SDK57 project:

```text
C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly
```

SDK54 Expo-Go test copy:

```text
C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly-sdk54-test
```

The overlay intentionally contains no root `package.json`, so it will not replace either Expo dependency tree.

## 3. Database check

From the real project:

```cmd
npm --prefix server run migrate
```

It should report that migrations are up to date. v1.11 does not add a migration.

## 4. Authoritative checks

Run from the real SDK57 project:

```cmd
npm --prefix server run typecheck
npm run typecheck
npm --prefix server run logic
npm --prefix server run smoke
```

The smoke test must finish with:

```text
Togetherly API smoke test passed all checks.
```

The expanded smoke suite now also checks live-location privacy/manual-timezone protection and task creation with checklist steps.

From the SDK54 Expo-Go copy, run:

```cmd
npm run typecheck
npx expo-doctor
```

If Expo Doctor reports only that `.expo/` is not ignored by Git, that is a repository-hygiene warning rather than an app-runtime failure. Add `.expo/` to `.gitignore` if desired.

Do **not** run `npm audit fix --force` while validating this build.

## 5. Manual acceptance test

### Automatic timezone
1. Set timezone mode to Automatic.
2. Turn live location sharing off.
3. With location permission already granted, background then foreground Togetherly.
4. Confirm the profile timezone can refresh from the device location without enabling live sharing.
5. Switch to Manual and confirm the searchable timezone picker remains available and location updates do not overwrite the chosen manual timezone.

### Live location
1. Enable Share my location on account A.
2. Confirm account B sees A's coloured pin and update age.
3. Enable sharing on B and confirm distance apart is sensible (metres at short distances; decimals for short-km ranges).
4. Move/update a device and confirm the mobile map re-fits to the current positions.
5. Stop updates temporarily and confirm `Live` naturally ages to `Updated … ago`.
6. Turn A sharing off and confirm B can no longer receive A's coordinates.
7. On web, confirm no raw latitude/longitude values are exposed in the fallback.

### Tasks
1. Start creating a new task.
2. Add checklist steps **before saving** the parent task.
3. Give a step its own due date/duration.
4. Save and confirm the steps persist.
5. Confirm a step due date later than the parent task is rejected.
6. Confirm Now/Open/All/Done behaviour remains intact.

### Navigation / copy
1. Together should show Live location directly inside Connect.
2. Plan should show Tags inside Organise.
3. More should show the compact personal profile card, Search, Manage, and Sign out without duplicated partner/timezone summary information.
4. Check Tags, Availability, Countdowns, Notifications and Themes breadcrumbs for their new parent locations.

## 6. Start testing

Backend:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly"
npm --prefix server run dev
```

Expo Go test copy:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly-sdk54-test"
npx expo start -c --lan
```

Press `w` in the Expo terminal for the browser client and scan the QR code with Expo Go for the iPhone client.
