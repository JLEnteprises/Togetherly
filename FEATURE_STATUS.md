# Togetherly v1.11 — Feature Status

## Core shared features
Working in source: accounts/onboarding, couple linking, participant colours, Tasks/checklists/recurrence, Lists, Notes, Text/Draw Scratchpad, Calendar, Countdowns, Availability/schedules, Trips, Goals, Tags/custom drawn icons, Activities/date ideas, Daily Question + History, Mood, Memories, Photos + Albums, Timeline, Memory Jar, Search, Notifications and settings.

## Play Together
Working in source: Relationship Bingo, Hangman, This or That, How Well Do You Know Me?, Draw Together and Decision Tools, backed by shared couple-scoped game sessions.

## Live location / timezone
Working in source: opt-in persistent sharing, participant-coloured mobile map pins, distance, update age, stale-state handling, foreground updates, background-task architecture, sharing-off privacy, automatic timezone derived from location, and searchable manual timezone override.

Expo Go can exercise foreground location. Background iOS location must be validated in a development/IPA build because Expo Go does not provide the final native background-location environment.

## v1.11 polish
- automatic timezone foreground refresh without enabling live sharing;
- background task session restoration;
- better map empty/stale/camera/distance behaviour;
- checklist steps during initial Task creation;
- flatter Plan/Together/More navigation;
- stale breadcrumb correction;
- production copy/meta-commentary cleanup;
- obsolete Home preview code removed.

## Still deployment/native work rather than missing everyday product UI
- production hosting/HTTPS/secrets;
- Apple signing/provisioning and final bundle identifier;
- actual iOS background-location validation in a signed native build;
- native APNs push banners;
- final App Store artwork/privacy/support metadata;
- offline write/conflict-aware sync and optional future iOS widgets.
