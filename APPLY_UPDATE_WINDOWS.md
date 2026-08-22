# Togetherly v1.9 — Apply & Test on Windows

## 1. Stop Expo and backend
Press `Ctrl+C` in the running Expo and backend terminals. Docker/PostgreSQL can stay running.

## 2. Apply the overlay
Extract `Togetherly-v1.9-Polished-Home-Overlay.zip` and copy its **contents** over both projects, choosing **Replace files in destination**:

```text
C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly
C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly-sdk54-test
```

The overlay intentionally has no root `package.json`, so it does not replace either Expo dependency tree.

## 3. Database
v1.9 adds no migration. Safe check:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly"
npm --prefix server run migrate
```

Expected: `Database migrations are up to date.`

## 4. Authoritative checks
Run in the real SDK57 project:

```cmd
npm --prefix server run typecheck
npm run typecheck
npm --prefix server run logic
npm --prefix server run smoke
```

The smoke suite should finish with:

```text
Togetherly API smoke test passed all checks.
```

For the SDK54 test copy:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly-sdk54-test"
npx expo-doctor
npm run typecheck
```

## 5. Manual v1.9 checks
- Home Scratchpad starts compact and expands only after Text/Draw is tapped.
- Saving the Home Scratchpad collapses it back to a preview.
- Cancelling an unsaved Home Scratchpad edit restores the saved version.
- Long-distance clocks use each participant colour and do not show redundant visible name labels.
- Today remains one compact card; task alerts/attention summaries still work.
- Quick Actions are compact; an active Play Together game can replace Play with a Continue action.
- Photos opens with `All photos | Albums`.
- Albums can still be created, opened, edited, populated, emptied and deleted.
- Opening the old `/features/albums` route redirects to Photos > Albums.
- Memories still links to Photos, Timeline and Memory Jar.

## 6. Start testing
Backend:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly"
npm --prefix server run dev
```

SDK54 Expo Go:

```cmd
cd /d "C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly-sdk54-test"
npx expo start -c --lan
```

Use `w` for the browser client and the QR code for iPhone.
