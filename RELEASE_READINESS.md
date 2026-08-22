# Togetherly v1.9 — Release Readiness

The v1.9 overlay is statically clean in the packaging environment and is ready for installed-project validation.

Still required on the Windows project before treating the build as cleared:

```cmd
npm --prefix server run typecheck
npm run typecheck
npm --prefix server run logic
npm --prefix server run smoke
```

The SDK54 Expo-Go copy should also pass `npm run typecheck` and Expo Doctor aside from any local `.expo/` git-ignore warning.

Production/deployment work remains separate: final bundle identifier, Apple signing, production HTTPS/API hosting, store artwork/metadata, privacy/support URLs, and native push if desired.
