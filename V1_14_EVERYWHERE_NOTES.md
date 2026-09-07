# Togetherly v1.14 — Everywhere

v1.14 extends Togetherly beyond the open phone app. The goal is ambient, low-friction connection: relationship signals can reach the partner while the app is closed, and the most glanceable parts of Togetherly can live on Apple Watch and the iPhone Lock Screen.

## Push notifications

Implemented in source:
- Expo push-token registration per device, re-registration, disconnect and invalid-token cleanup;
- permission is requested only when the user explicitly enables push;
- deep-link data on delivered notifications;
- Android relationship/planning/general channels;
- test-push endpoint and in-app push status UI;
- push dispatch from Togetherly's existing notification creation path;
- sign-out/password/security flows deactivate old device tokens.

Push delivery uses Expo Push Service. A signed native build still needs a real EAS project plus APNs/FCM credentials.

## Love & little signals

Implemented in the phone app, Watch API and widgets:
- **Love Tap** — a tiny affectionate signal;
- **Thinking of You** — a lighter “you crossed my mind” signal;
- dedicated notification preference;
- anti-spam pause so rapid repeated taps do not become noisy;
- in-app relationship-ping event + remote push to the partner.

## Apple Watch companion

Native SwiftUI watchOS target in `targets/TogetherlyWatch` includes:
- partner name, participant colour, local time and inferred availability/status;
- latest shared mood/need;
- **I'm here** acknowledgement for a partner check-in;
- big Love Tap and Thinking of You actions;
- quick mood + need check-in;
- Daily Question waiting/answered/ready state;
- next-visit countdown or relationship-days fallback;
- refresh and cached-state behaviour.

Watch actions first try the Togetherly API directly with a restricted Watch token. If that fails, the Watch queues the action through WatchConnectivity for the paired iPhone.

## Watch security model

The Watch does **not** receive the user's normal refresh token. The phone provisions a random restricted Watch session credential which:
- expires after 90 days;
- is stored hashed on the server;
- can access only the Watch endpoints;
- is refreshed by the phone before expiry;
- is revoked by account security/sign-out flows.

The restricted token and glanceable relationship state are shared with Apple extensions through the configured App Group.

## Complications / Smart Stack

`targets/TogetherlyWatchWidget` contains WidgetKit widgets for:
- Partner — mood/status + partner local time;
- Love Tap — interactive heart button;
- Next Visit — countdown / relationship fallback.

They use current WidgetKit accessory families rather than deprecated ClockKit.

## iPhone Lock Screen widget

`targets/TogetherlyWidget` contains:
- Partner status/local-time accessory widget;
- interactive Love Tap accessory widget;
- an optional small Home Screen partner card with Love Tap.

## Shared native bridge

`modules/togetherly-watch-bridge` uses WatchConnectivity to:
- provision credentials and current state to the Watch;
- retain current state in an App Group for widgets;
- reload widget timelines when state changes;
- receive queued Watch actions on the iPhone;
- clear shared state on sign-out.

## Database

New migration: `012_push_watch_everywhere.sql`
- `device_push_tokens`;
- `watch_sessions`;
- `relationship_pings`;
- `notification_relationship_pings` preference;
- notification-kind support for Love/Thinking of You.

## Deliberately external

A source package cannot contain your Apple signing identity, APNs key, EAS project identity, provisioning profiles or App Store credentials. Those are supplied during the test/build steps in `EVERYWHERE_TEST_GUIDE.md`.
