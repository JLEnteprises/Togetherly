# Togetherly v1.11 — Unsigned IPA Build Kit

This overlay adds a GitHub Actions macOS build that compiles the real Expo SDK 57 Togetherly project into an **unsigned iPhone IPA**. Sideloadly can then sign/install that IPA with a free or paid Apple ID.

## Why a cloud macOS build?

iOS device binaries require Xcode. The normal Togetherly development machine is Windows, so the workflow uses a GitHub-hosted `macos-26` runner. The build intentionally disables Xcode code signing; Sideloadly performs signing at install time.

## Important: use the REAL SDK57 project

Apply this kit to:

`C:\Users\Liam\Downloads\togetherly-selfhosted-backend\togetherly\togetherly`

Do **not** use `togetherly-sdk54-test` for the IPA. SDK54 exists only for Expo Go testing. The real app is SDK57.

## API / PC server

The workflow asks for `api_url` each time it runs. For the current home network the default is:

`http://192.168.1.16:4000`

The iPhone must be able to reach that address. With a private LAN address, that normally means the iPhone is on the same home network and the Windows firewall allows TCP 4000.

If the PC's LAN IP changes, use the new IP on the next build. A router DHCP reservation for the PC is recommended while the PC is acting as the server.

## Build workflow

1. Put the real SDK57 project in a GitHub repository (private is fine).
2. Open **Actions** in GitHub.
3. Select **Build Togetherly unsigned IPA**.
4. Choose **Run workflow**.
5. Confirm the API URL and run it.
6. When the job finishes, download the `Togetherly-v1.11-unsigned-IPA` artifact.
7. Extract the artifact ZIP; inside is `Togetherly-v1.11-unsigned.ipa`.
8. Drag that IPA into Sideloadly and install it with the same Apple ID each time.

## Sideloading notes

With a free Apple ID, sideloaded apps normally expire after 7 days and free accounts are limited to a small number of active sideloaded apps. Sideloadly can refresh apps when the PC is available. To preserve the installed app/data when refreshing, keep using the same Apple ID and bundle ID.

## Location behaviour

Foreground live location can be tested immediately in the IPA. Background location is configured in Togetherly, but actual iOS background update cadence still needs real-device validation after installation.
