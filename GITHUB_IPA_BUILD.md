# Togetherly v1.14.3 — GitHub unsigned IPA build

This workflow lets a Windows user press **Run workflow** on GitHub, let a GitHub-hosted Mac compile Togetherly, then download an unsigned IPA and sign/install it locally with Sideloadly.

## What GitHub produces

Every successful run uploads one artifact containing:

- `Togetherly-v1.14.3-Everywhere-unsigned.ipa` — iPhone app + Apple Watch companion + Watch complication/Smart Stack extension + iPhone WidgetKit extension.
- `Togetherly-v1.14.3-PhoneOnly-unsigned.ipa` — the same phone build with Watch/widgets stripped. Use this if free Apple-ID signing rejects the full extension/entitlement set.
- `build-info.txt` — exact bundle/API/build settings used.

The workflow deliberately builds with code signing disabled. Sideloadly performs the 7-day Personal Team signing on your Windows PC.

## First-time GitHub setup

1. Create a GitHub repository and upload/push the **contents of this Togetherly folder**. The `.github` folder must be included.
2. Open the repository → **Actions** → **Build Togetherly unsigned IPA** → **Run workflow**.
3. Enter your API URL. An installed phone cannot use `localhost`. If both phones are remote from your PC, use a public HTTPS API/tunnel URL.
4. For Expo remote push, enter your `EXPO_PUBLIC_EAS_PROJECT_ID` UUID. It is okay to leave it blank while testing everything except Expo push registration.
5. Keep bundle ID as `com.example.togetherly` for now unless you have chosen your final identifier.
6. For an unsigned build, the Team ID field can stay `0000000000`. GitHub is not signing the IPA; this value only satisfies Apple-target/Xcode project generation.

Instead of typing values each run, optionally create GitHub repository **Variables** under Settings → Secrets and variables → Actions:

- `TOGETHERLY_API_URL`
- `TOGETHERLY_EAS_PROJECT_ID`
- `TOGETHERLY_BUNDLE_ID`
- `TOGETHERLY_APPLE_TEAM_ID`

A value typed into the Run workflow form takes priority over a repository variable.

## Download the IPA

When the run finishes:

1. Open the completed workflow run.
2. Scroll to **Artifacts**.
3. Download `Togetherly-<run number>-unsigned-IPAs`.
4. Extract the downloaded artifact ZIP.
5. Start with `Togetherly-v1.14.3-Everywhere-unsigned.ipa`.

## Sideloadly (7-day signing)

1. Install the current Sideloadly on Windows.
2. Connect the iPhone via USB and trust the PC.
3. Drag the unsigned IPA into Sideloadly.
4. Select the iPhone and enter the Apple ID used for that phone's sideloaded apps.
5. Start the Apple ID sideload/sign operation.
6. Enable Developer Mode on iOS if prompted, then trust the developer profile under Settings → General → VPN & Device Management.
7. Reuse the same Apple ID and bundle ID when installing later Togetherly builds so Sideloadly can overwrite/refresh the app rather than creating a separate install.

Your partner can use the **same unsigned IPA** but should sign it on their own computer/device with their own Apple ID.

### If the full Everywhere IPA fails during free signing

Free Personal Team provisioning has much tighter entitlement/App-ID restrictions than a paid Apple Developer Program team. The full IPA contains multiple embedded Apple targets and shared-container/push capabilities. If Sideloadly reports an extension, entitlement, App Group, or App-ID signing failure, try `PhoneOnly-unsigned.ipa` first. That confirms the phone app while we isolate what Apple's free provisioning permits for Watch/widgets.

Sideloadly can also remove extensions, but the supplied PhoneOnly IPA is already stripped consistently from the exact same build.

## Push caveat

The app uses Expo Push tokens, so a valid Expo/EAS project UUID must be embedded for **Enable Push** to register. Separately, Apple's actual APNs entitlement/provisioning may not be available under free 7-day Personal Team signing. If the app works but remote push does not, capture the Sideloadly/device log before treating it as a Togetherly server bug.

## Watch caveat

The GitHub build verifies that the Watch app, Watch widget and iPhone widget are physically embedded in the full IPA. Whether Sideloadly + a free Apple ID can provision/install all of those Apple targets is a separate Apple signing constraint. The full IPA is intentionally supplied so we can test that boundary rather than guessing.
