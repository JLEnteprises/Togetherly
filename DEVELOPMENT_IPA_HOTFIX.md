# Togetherly Development IPA hotfix

This patch keeps the Xcode 26 / Swift 6.2 and Watch-platform repairs, then adds an unsigned phone-only development IPA for launch-crash debugging.

The workflow temporarily installs `expo-dev-client` on the GitHub runner before `expo prebuild`, builds the normal release IPAs, then builds a Debug iPhone app and packages it as:

`Togetherly-v<version>-Development-unsigned.ipa`

The development IPA intentionally strips Watch/widgets so Sideloadly extension signing does not obscure the phone-app startup error.

After sideloading the development IPA, run on the PC:

`npx expo start --dev-client -c --lan`

Keep the iPhone and PC on the same Wi-Fi and open Togetherly. Metro/dev-client should expose the startup exception instead of the release build simply exiting.
