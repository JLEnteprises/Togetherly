# Togetherly v1.14 — Test Release Readiness

v1.14 is the **Everywhere test candidate**: v1.13's consumer-product design plus remote push, Love/Thinking-of-You signals, a native SwiftUI Apple Watch companion, Watch complications/Smart Stack widgets and iPhone Lock Screen widgets.

## Validated in this package

- server `npm run typecheck`: **PASS**;
- server `npm run build`: **PASS**;
- 162 TypeScript/TSX source files: **syntax parse PASS**;
- all native Swift files: **Swift 6.2 parser PASS**;
- Apple target config files: **syntax/evaluation PASS**;
- target types resolve as `watch`, `watch-widget`, and `widget` with the same generated App Group;
- app/package/server JSON manifests: valid;
- no merge-conflict markers are intended in source;
- no `node_modules`, generated iOS project, `.env`, signing key, provisioning profile or certificate is shipped;
- root/app/server versions are `1.14.3`;
- latest database migration is `012_push_watch_everywhere.sql`.

## Why there is no root package-lock in this ZIP

v1.14 adds `expo-notifications` and `@bacons/apple-targets`. The packaging environment could not reach the npm registry reliably enough to generate an authoritative new root lockfile. Keeping the old v1.13 lock would make `npm ci` fail because it would be out of sync. The stale lock is therefore intentionally omitted.

For this test package run `npm install` once. That resolves the new dependencies and creates a fresh `package-lock.json`; after that, use `npm ci` normally. The server lockfile is retained because server dependencies did not change.

## Apple/Xcode boundary

Swift source can be parsed here, but watchOS/WidgetKit targets cannot be linked or signed on Linux. The package now includes a GitHub Actions macOS/Xcode 16.4 unsigned-IPA workflow. Its first GitHub run is the authoritative link/build test for the native Apple targets; signing/installing remains a separate Sideloadly/Apple provisioning step. `@bacons/apple-targets` requires Xcode 16+/macOS 15+ for native prebuild/build.

## Required before public release

- real bundle/package identifiers (the sample defaults remain `com.example.togetherly`);
- EAS project ID + Apple/Google push credentials;
- production HTTPS API and secrets/CORS origins;
- Apple signing/provisioning and physical iPhone/Watch validation;
- scalable object storage + thumbnails for large photo libraries;
- final store metadata/privacy/support URLs/screenshots.
