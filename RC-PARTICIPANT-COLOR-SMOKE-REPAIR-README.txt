Togetherly v1.14.3 — RC Participant Colour Smoke Repair

Failure
-------
The RC live smoke suite stopped at:

Creator colour choice or opposite partner colour was not preserved.

Root cause
----------
This was a stale smoke-test expectation, not a runtime participant-colour bug.

The current workspace colour model stores and returns canonical dynamic #RRGGBB colours.

Legacy aliases remain accepted:
purple -> #BE9AFF
green  -> #B7CB7C

The smoke suite still expected:
'green'
'purple'

instead of the normalized values.

Repair
------
Changes only:
server/src/smoke.ts

It updates:
1. initial creator/join colour assertion
2. later colour-swap assertion
3. later preferred_participant_color swap assertion

It adds local smoke constants:
LEGACY_PURPLE = '#BE9AFF'
LEGACY_GREEN  = '#B7CB7C'

No runtime app/backend behavior changes.
No migration.
No dependency changes.

The existing RC standalone Photos smoke coverage is preserved.

Run — Windows CMD
-----------------
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_RC_PARTICIPANT_COLOR_SMOKE_REPAIR.js

It reruns the complete RC gate:

node scripts/rc-release-candidate-audit.mjs
node scripts/i3-ui-regression-audit.mjs
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd --prefix server run smoke

Success:
Togetherly API smoke test passed all checks.
[RC repair] ALL VALIDATIONS PASSED
