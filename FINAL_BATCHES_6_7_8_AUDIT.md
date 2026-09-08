# Togetherly Final Combined Audit - Batches 6, 7 and 8

Audited against the remaining untouched/current-main areas after Batches 1-5.

## Batch 6 - Account, privacy and push

### API offline-cache cleanup
Togetherly intentionally caches authenticated GET responses per user for offline fallback. The cache key is user-scoped, which prevents one signed-in account from reading another account's cache through the app, but those cached responses remained in AsyncStorage after sign-out/session invalidation.

That cache can include sensitive couple content depending on which GET routes were visited.

Fix:
- when a stored auth session is removed, all cached API responses for that user are removed from AsyncStorage;
- cache cleanup is best-effort and cannot block sign-out.

This preserves offline caching while signed in and improves privacy after logout/password reset/session revocation.

### Push registration/account switching
The native push registration structure already contained an optional `userId`, but registration never stored it and status never checked it.

On a shared phone or after switching Togetherly accounts, stale local token state could therefore be shown as "registered" for the wrong signed-in account if server re-registration failed.

Fix:
- local push registration is now stamped with the signed-in user ID;
- push status only reports registered when the local token belongs to the current user;
- failed re-registration no longer presents another account's stored token as successfully registered.

The backend already reassigns a token to the authenticated user on successful registration and deactivates all user push tokens during password change, sign-out-all, password reset and account deletion.

## Batch 7 - Home, navigation, settings and privacy review

Reviewed:
- Home layout storage is namespaced by user ID.
- Settings accessibility preferences are routed through the preferences provider.
- Private-note/check-in privacy language matches the intended access model.
- Account deletion/password/security flows are backed by server-side session revocation, Watch-session revocation, push deactivation and live-location clearing.
- Existing push deep links are restricted to internal paths beginning with `/`.

No broad redesign was applied here because the existing remaining UI/navigation structure did not justify risky late-stage changes.

## Batch 8 - Build/release/regression

### Dynamic API build input
The GitHub unsigned-IPA workflow still required a real API URL even though the app now discovers the current API through `runtime-config.json`.

Fix:
- leaving API URL blank now embeds `https://example.invalid` as the fallback;
- dynamic runtime discovery remains the normal live endpoint source;
- a real embedded URL can still be supplied manually if desired.

The workflow is `workflow_dispatch` only, so runtime-config URL commits do not automatically rebuild the IPA.

### CI verification
The IPA workflow previously typechecked only the client.

Fix:
- install backend dependencies;
- server TypeScript typecheck;
- run the pure logic smoke-test suite before native build.

### Local final verifier
`FINAL_VERIFY.cmd` runs:
1. client TypeScript check;
2. backend TypeScript check;
3. pure logic smoke tests;
4. `git diff --check`.

It uses `npm.cmd`, avoiding the Windows PowerShell execution-policy problem encountered earlier.

## Important limits

This is the end of the static/code audit batches, not a claim that every native feature is proven on physical hardware.

Still requiring real-device verification:
- free-Personal-Team Watch/App Group/Widget signing;
- push entitlement delivery;
- background location behavior under iOS power management;
- Watch direct HTTPS + WatchConnectivity handoff;
- actual two-phone realtime recovery after a Cloudflare quick-tunnel hostname change.

Those are runtime/signing behaviours that source inspection and TypeScript checks cannot guarantee.
