Togetherly v1.14.3 — D9 Shared Celebrations Repair V2

Fixes the remaining TypeScript error:

  src/components/common/CelebrationMoment.tsx
  'moment' is possibly 'null'

Why:
TypeScript correctly narrows `moment` after `if (!moment) return` in the component body,
but that narrowing is not retained inside the nested `runAction()` function.

Fix:
`runAction()` now performs its own local null guard before reading `moment.onAction`.

This repair preserves all prior D9 work and reruns:
- frontend typecheck
- server typecheck
- server logic smoke checks

No migration.
No new dependency.

Run:
  node APPLY_RELEASE_D9_SHARED_CELEBRATIONS_REPAIR_V2.js
