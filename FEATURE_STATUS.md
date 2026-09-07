# Togetherly v1.14 — Feature Status

## Core app

All v1.13 Home / Plan / Together / Us / More features and v1.12 privacy/reliability hardening remain in source.

## Push — implemented in source

- native iOS/Android notification permission/status flow;
- Expo push token registration and invalid-token cleanup;
- backend remote delivery from Togetherly notification events;
- deep-link payloads;
- Android relationship/planning/general channels;
- per-category relationship notification preference;
- test notification endpoint/UI;
- device deactivation during sign-out/security flows.

## Togetherly signals — implemented

- Love Tap;
- Thinking of You;
- phone UI + in-app notification + remote push;
- Watch + widget endpoints;
- anti-spam protection.

## Apple Watch — implemented in native source

- SwiftUI companion app;
- partner status/local time;
- latest shared mood/need + acknowledgement;
- Love Tap / Thinking of You;
- quick check-in;
- next visit / relationship days;
- Daily Question state;
- direct HTTPS API actions with restricted Watch credential;
- WatchConnectivity fallback/cached state.

## Widgets — implemented in native source

- Watch partner-status complication;
- Watch interactive Love Tap complication;
- Watch next-visit complication / Smart Stack-compatible accessory content;
- iPhone Lock Screen partner status;
- iPhone Lock Screen Love Tap;
- optional small iPhone Home Screen partner card.

## Still requires real build credentials/infrastructure

- EAS/Apple project provisioning and APNs credentials;
- physical Apple Watch and iPhone validation;
- production HTTPS for independent cellular/Wi-Fi Watch actions;
- object media storage remains a later scaling integration.
