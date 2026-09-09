Togetherly v1.14.3 — I3 Love Tap Audit Repair

What failed
-----------
The I3 regression audit reported:

FAIL src/components/dashboard/HomeConnectionActions.tsx: Love Tap remains a small direct signal

This was a false-negative in the audit itself.

The actual HomeConnectionActions component uses a dynamic JSX label:

- Love sent ♥
- Sending…
- Love Tap

The first I3 audit incorrectly required a static:
label="Love Tap"

Repair
------
This repair changes only:
scripts/i3-ui-regression-audit.mjs

The repaired rule verifies:
- the Love Tap dynamic label branch exists
- the 'Love Tap' default text remains present

No application runtime source is changed.
No migration.
No dependency changes.

Run from Windows CMD:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_I3_LOVE_TAP_AUDIT_REPAIR.js

It reruns:
node scripts/i3-ui-regression-audit.mjs
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

Success ends with:

[I3 repair] ALL VALIDATIONS PASSED
