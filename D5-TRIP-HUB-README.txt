Togetherly v1.14.3 — Release D5: Trip Hub

Purpose
Turn Trip Detail from a technical linked-record planner into a couple-facing mini dashboard where “everything for our trip is here.”

Changes
- Trip hero now leads with destination, human-readable dates, and days-until/active-trip state.
- Packing shows real completed / total list progress.
- First linked Goal appears as the trip goal/fund with progress.
- Calendar and countdown are first-class trip status rows.
- Trip notes become “Things to remember” rather than metadata.
- Technical add/link/remove controls move behind “+ Add to trip”.
- Existing backend links, realtime refresh, quick setup, editing, and unlinking are preserved.

No migration.
No new npm dependency.

Run from the Togetherly project root:
  node APPLY_RELEASE_D5_TRIP_HUB.js

The installer automatically runs:
  npm.cmd run typecheck
  npm.cmd --prefix server run typecheck
  npm.cmd --prefix server run logic
