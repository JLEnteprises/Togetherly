# Togetherly Batch 5 - Location, Runtime API, Realtime, Watch and Long-Distance Audit

Audited against the current `JLEnteprises/Togetherly` main branch on 2026-09-08.

## Runtime API discovery

A significant efficiency issue was found in `api.ts`: every REST request called `initializeBackendConfig()`, and after each completed discovery the in-flight promise was reset to null. That meant normal app traffic could fetch `runtime-config.json` from GitHub again and again.

Fix:
- runtime discovery is cached for 60 seconds;
- only one discovery can run at a time;
- a failed backend connection forces a fresh runtime-config lookup;
- if the discovered API URL changed, the failed REST request retries once against the new URL.

This preserves the no-rebuild Cloudflare quick-tunnel design without putting a GitHub fetch in front of effectively every API call.

## Runtime config timeout

The raw GitHub configuration lookup had no explicit timeout. If that request stalled, a normal Togetherly API call could stall with it.

Fix:
- runtime-config GitHub fetch is aborted after 4 seconds;
- cached or embedded fallback remains available.

## Realtime / WebSocket

Realtime previously relied on `backendConfig` already having been initialized elsewhere. Reconnects also kept using the existing URL, which is particularly fragile when the quick-tunnel hostname changes.

Fix:
- realtime resolves runtime configuration before opening the socket;
- reconnect attempts periodically force runtime discovery (rate-limited to once per 15 seconds);
- if no API URL is configured yet, realtime schedules another attempt rather than silently giving up.

## Apple Watch / widgets

The phone Watch bridge returned early when `backendConfig.isConfigured` was false, before ensuring runtime discovery had run.

Fix:
- Watch refresh now resolves runtime backend configuration first;
- the synced Watch context therefore receives the currently resolved API URL;
- existing graceful WatchBridge fallback behavior is not changed.

The native Watch model already uses the API URL passed in the phone context and has a 12-second direct HTTPS timeout, with WatchConnectivity queue fallback for actions.

## Live location

The backend already protects location visibility by:
- requiring a linked couple;
- returning coordinates only while sharing is enabled;
- hiding stale locations after 24 hours;
- clearing stored coordinates when sharing is disabled;
- validating coordinate ranges.

A privacy edge case existed on the phone: when turning sharing off, the background task stopped first, but the foreground watcher could remain alive if the server revoke failed because the provider still considered sharing enabled.

Fix:
- turning location off immediately removes the foreground watcher;
- background updates are stopped immediately;
- then the server-side revoke is attempted;
- if the network revoke fails, the user still receives the error, but the phone itself is no longer continuing to transmit new positions.

Enabling was also reordered so the server sharing flag is enabled before background delivery starts, avoiding an initial background position racing the `/location/sharing` request and receiving a 409.

The location screen text now accurately notes that background updates depend on device permission.

## Time zones / long-distance

Automatic time-zone lookup uses coordinates locally through `tz-lookup`, and the server only applies a location-supplied timezone when the profile is in automatic timezone mode. Partner clocks use named IANA time zones, which handles DST changes correctly.

No schema change was made in this batch.

## Free Apple ID note

This code audit does not change Apple signing/entitlement restrictions. Watch apps, WidgetKit, App Groups and some push capabilities can still behave differently when sideloaded with a free Personal Team. PhoneOnly remains the reliable fallback when extension signing fails.

## Verification

Run:

```cmd
npm run typecheck
npm --prefix server run typecheck
```

Then practical tests:

1. Start Togetherly with a working runtime config and use several screens. REST requests should not require a GitHub config fetch before every request.
2. Change the quick-tunnel URL in `runtime-config.json`, stop the old tunnel, then make an API request. The app should rediscover and retry on the new URL without an IPA rebuild.
3. Leave both phones connected and restart/change the tunnel. Realtime should recover after runtime rediscovery.
4. Open Notifications -> Apple Watch & widgets -> Refresh Watch state. The Watch context should receive the current runtime API URL.
5. Enable location, confirm partner position updates.
6. Turn location off while online: coordinates should disappear for the partner.
7. Turn location off while the backend is deliberately unreachable: the app should show an error, but local foreground/background position transmission should already be stopped.
8. Re-enable location after backend returns and confirm updates resume.
