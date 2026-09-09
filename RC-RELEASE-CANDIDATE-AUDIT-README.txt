Togetherly v1.14.3 — Release Candidate Audit

Verified baseline
-----------------
GitHub head:
66fc1dc306255cfd152b759b010d1b574a6af7e8

I3 is verified as one clean commit above I2 with exactly five final I3 files:
- APPLY_RELEASE_I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY.js
- I3-UI-REGRESSION-CROSS-TAB-CONSISTENCY-README.txt
- APPLY_RELEASE_I3_LOVE_TAP_AUDIT_REPAIR.js
- I3-LOVE-TAP-AUDIT-REPAIR-README.txt
- scripts/i3-ui-regression-audit.mjs

Purpose
-------
This is the release-candidate gate after G1–G6, H1–H3 and I1–I3.

It does not redesign working UI.

It adds:
1. scripts/rc-release-candidate-audit.mjs
2. H1–H3 standalone Photos coverage to server/src/smoke.ts

Static RC audit
---------------
Checks:
- package.json / server/package.json / app.json parsing
- client/server/app version agreement
- local relative and @/ import resolution
- Expo Router literal feature destinations
- duplicate literal Fastify registrations
- literal client apiRequest paths against server routes
- migration number uniqueness
- migrations 018 and 019 presence
- G1–I3 architecture markers
- final I3 Love Tap repair marker
- TODO/FIXME/HACK/XXX scan
- referenced app/build asset existence
- local file dependency existence

Distribution warnings
---------------------
These are intentionally WARNINGS rather than source-code audit failures:

Current app.json still uses:
- iOS bundleIdentifier: com.example.togetherly
- Android package: com.example.togetherly
- App Group identity based on com.example.togetherly

.env.example also intentionally leaves:
- EAS project ID unset
- Apple Team ID unset
- local HTTP API URL as the development example

Therefore:

A passing RC gate means the code/integration tree is a release candidate.

It does NOT mean the repository is already configured as a signed App Store / Play Store production binary.

RC live smoke expansion
-----------------------
The existing smoke suite already covers authentication, couple isolation, realtime, tasks, notes, lists, calendar, trips, legacy Memory compatibility, activities, mood privacy, availability and games.

The G/H redesign introduced a coverage gap: standalone H1–H3 Photos were not explicitly smoke-tested.

RC adds tests for:
- Memory-created first-class Photos appearing in GET /photos
- standalone Photo creation without a Memory
- cross-couple Photo isolation
- photo-based Album creation
- individual Photo membership
- removing a Photo from an Album without deleting it
- Memory selection of an existing standalone Photo
- linked_memory_id association
- deleting a Memory unlinks rather than deletes its Photo
- photo-album membership survives Memory deletion
- deleting a Photo Album preserves Photos

The smoke test creates unique temporary accounts and cleans up only its own generated users/couples at the end.

Validation run
--------------
The installer runs:

node scripts/rc-release-candidate-audit.mjs
node scripts/i3-ui-regression-audit.mjs
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd --prefix server run smoke

No expo lint.

No migration is required.

No dependency change.

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_RC_RELEASE_CANDIDATE_AUDIT.js

Expected successful endings include:

RC STATIC AUDIT PASSED
I3 UI REGRESSION AUDIT PASSED
Togetherly API smoke test passed all checks.
[RC] ALL VALIDATIONS PASSED

If the static audit prints WARN lines for bundle IDs/EAS/Apple Team/API URL, those are expected deployment-readiness warnings and do not fail the code RC gate.
