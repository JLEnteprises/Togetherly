# Togetherly v1.11 — Release Readiness

v1.11 is a source-level release candidate focused on product polish and reliability. Static navigation/import/syntax/accessibility checks are clean and the deterministic date/recurrence/task-attention logic suite passes.

Before treating it as a tested release on the user's actual setup, rerun:

```cmd
npm --prefix server run typecheck
npm run typecheck
npm --prefix server run logic
npm --prefix server run smoke
```

Also rerun the SDK54 client typecheck / Expo Doctor and perform the two-account manual tests in `APPLY_UPDATE_WINDOWS.md`.

No v1.11 database migration or new npm dependency is required. The latest migration remains `011_live_location.sql`.

Background live location should not be called production-verified until it has been exercised in the signed iOS development/IPA build; Expo Go only covers the foreground testing path.
