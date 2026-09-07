# Togetherly v1.12 hardening pass

This overlay builds on v1.11 and focuses on privacy, concurrency, production perimeter hardening, and polish rather than adding another large feature set.

## Implemented in this pass

- Fixed invalid `TimezonePickerField` theme keys (`textMuted` / `textPrimary`).
- Daily Question answers are now locked on the server once both partners have answered. The lock is serialized at the couple row so simultaneous answer requests cannot cross the reveal boundary incorrectly.
- Daily Question pre-reveal edits no longer send duplicate partner notifications.
- Turning live location sharing off now clears latitude, longitude, accuracy, and capture time from PostgreSQL rather than merely hiding them in responses.
- Location responses withhold stale positions after 24 hours and reject far-future timestamps as fresh data.
- Signing out, signing out all devices, changing/resetting a password, or deleting an account disables and clears live-location data. Native sign-out also stops the background Expo location task.
- Production server perimeter now supports HTTPS enforcement, trusted proxy handling, a CORS allowlist, baseline security headers, and in-process throttling for registration/login/refresh/password-reset endpoints.
- Tasks and Notes now support optimistic concurrency. The client sends the `updated_at` version it opened; stale saves receive HTTP 409 instead of silently overwriting the partner's newer edit.
- Long-distance Home clocks and visit countdowns refresh while the screen stays open.
- Primary tab navigation now uses a consistent SVG icon set instead of OS/font-dependent Unicode symbols.
- `Us` now acts more like a relationship-history hub, with relationship age, memory/photo/milestone counts, an On This Day card when applicable, and direct entry points to Timeline, Memory Jar, and Albums.
- Smoke coverage was extended for location erasure, stale task conflict protection, and Daily Question post-reveal locking.

## Validation performed

- Server TypeScript typecheck: PASS.
- Server TypeScript build: PASS.
- Fastify app construction: PASS (84 registered route tree entries in the test environment).
- `git diff --check`: PASS.
- Client parser/syntax pass across 117 TS/TSX source files: PASS.
- Full Expo client `npm run typecheck`: NOT VERIFIED in this environment because package downloads failed with DNS `EAI_AGAIN`; this was an environment dependency-fetch failure, not a compiler diagnostic from Togetherly.

## Still requires deployment/infrastructure work

These are intentionally not faked inside the overlay:

1. **Native push delivery** — add Expo Notifications/APNs/FCM credentials, persist device push tokens, and send server-side pushes from the existing notification events.
2. **Object storage for photos** — provision S3/R2/Supabase Storage (or equivalent), add authenticated upload URLs, thumbnails, and migrate existing data-URL media out of PostgreSQL.
3. **Native export as an attached JSON file** — add a direct `expo-file-system` dependency and `expo-sharing` for SDK 57, then write the export to cache and share the file rather than a giant text payload.
4. **Public web auth hardening** — if a public browser client is shipped, move long-lived refresh credentials toward appropriately secured HTTP-only cookies and add CSRF protections for cookie-authenticated mutations.
5. **Distributed rate limiting** — the included limiter protects a single API process. Multi-instance production hosting should move the counters to Redis or another shared store.

## New production environment settings

`server/.env.example` now includes:

- `TRUST_PROXY`
- `REQUIRE_HTTPS`
- `CORS_ORIGINS`

When `NODE_ENV=production`, `TRUST_PROXY` and `REQUIRE_HTTPS` default to enabled unless explicitly overridden. `CORS_ORIGINS` should contain the comma-separated browser origins that are allowed to call the API.
