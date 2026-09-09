Togetherly v1.14.3 — RC Public Participant Colour Contract Repair

Observed failure
----------------
The repaired live smoke suite reached /workspace/colors/swap successfully, then failed:

Preferred colours did not stay in sync after swap.

This is a real API contract bug, not another stale smoke assertion.

Root cause
----------
The dynamic participant-colour rollout made workspace identity colours arbitrary #RRGGBB strings.

Client Profile already expects:
preferred_participant_color: string | null

But server/src/auth/session.ts still had the old PublicUser contract:

preferred_participant_color: 'purple' | 'green' | null

and toPublicUser() only serialized literal legacy values:
purple
green

Any canonical stored value such as:
#BE9AFF
#B7CB7C
or another user-selected #RRGGBB colour

was returned to the client as:
null

That makes workspace myColor/partnerColor correct while profile.preferred_participant_color appears out of sync.

Repair
------
Changes only runtime file:

server/src/auth/session.ts

It:

1. widens server PublicUser.preferred_participant_color to string | null
2. adds canonical public colour normalization
3. maps legacy stored aliases:
   purple -> #BE9AFF
   green  -> #B7CB7C
4. passes valid arbitrary #RRGGBB values through in uppercase
5. returns null only for invalid/unset values

No migration.
No dependency change.
No client type change is required because src/types/database.ts already uses ParticipantColor = string.

Existing RC changes are preserved:
- scripts/rc-release-candidate-audit.mjs
- I3 audit
- standalone Photos smoke coverage
- participant-colour smoke repair

Run — Windows CMD
-----------------
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_RC_PUBLIC_PARTICIPANT_COLOR_CONTRACT_REPAIR.js

It reruns the entire RC gate:

node scripts/rc-release-candidate-audit.mjs
node scripts/i3-ui-regression-audit.mjs
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd --prefix server run smoke

Success should finish with:

Togetherly API smoke test passed all checks.
[RC contract repair] ALL VALIDATIONS PASSED
