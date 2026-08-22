# Togetherly v1.11 — Polish & Hardening Static Audit

Audit date: 2026-08-22

## Scope

This audit covers the v1.11 polish/hardening pass on top of v1.10 Live Location. No product capability was intentionally removed. The work focuses on location reliability, automatic timezone behaviour, task creation usability, navigation flattening, copy cleanup, and removal of obsolete Home implementation files.

## Source integrity

- TypeScript/TSX files parsed: **143**
- syntax diagnostics: **0**
- local relative / `@/` imports checked: **867**
- unresolved local imports: **0**
- literal `/features/...` navigation references checked: **70**
- missing feature destinations: **0**
- Expo Router page files excluding layouts: **44**
- Fastify route registrations: **116**
- duplicate Fastify method/path registrations: **0**
- direct `Pressable` controls inspected: **88**
- direct `Pressable` controls without `accessibilityRole`: **0**
- duplicate JSX attributes: **0**

## Location / timezone corrections

- automatic timezone can refresh from a one-time foreground location check even when live sharing is off;
- automatic refresh is throttled and does not repeatedly prompt for permission;
- manual timezone remains protected from location-driven overwrites;
- the background location task restores the persisted authenticated session before sending an update;
- mobile map has a proper no-location empty state;
- `Live` ages automatically into a last-updated status;
- distance formatting uses metres / decimal kilometres where appropriate;
- map camera re-fits as the visible shared positions change;
- web fallback no longer prints raw latitude/longitude values.

## Everyday usability corrections

- checklist steps can be created before the parent Task is first saved;
- initial step due dates/durations are validated and persisted with Task creation;
- Together: Live location is part of Connect rather than a redundant one-item Location group;
- Plan: Tags is part of Organise rather than a one-item optional-tools group;
- More is reduced to personal profile, Search, Manage and Sign out;
- stale breadcrumbs were corrected after the previous navigation consolidation;
- eight unused legacy Home preview components were deleted;
- Play Together and general product copy were shortened to normal consumer language;
- implementation/meta phrases such as “stroke renderer” and explanatory product-design commentary were removed from production UI.

## Logic checks

The deterministic utility suite was compiled and executed after the changes:

```text
PASS strict date-only validation
PASS strict local date-time validation
PASS monthly recurrence month-end clamping
PASS long-running recurrence fast-forward
PASS timezone-free all-day calendar dates
PASS yearly leap-day recurrence clamping
PASS smart task attention windows
Logic smoke checks passed.
```

## Verification limitation

This packaging environment does not contain the user's installed SDK57/SDK54 dependency trees or live PostgreSQL database. Therefore installed-project TypeScript checks and the full API/PostgreSQL/WebSocket smoke suite must still be rerun on Windows after applying the overlay.
