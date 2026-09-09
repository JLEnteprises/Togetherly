Togetherly v1.14.3 — Release E3
Paired Identity in Couple-Owned Spaces

WHAT THIS RELEASE DOES
- Adds a reusable CoupleIdentitySignature component.
- Shows both actual participant colours, both avatars and both names together.
- Uses an explicit neutral OURS centre label instead of inventing a third shared colour.
- Adds the paired signature to:
  * Us
  * Together
  * Couple profile
- Leaves Home's existing paired CoupleHero intact instead of duplicating it.
- Preserves E1 Shared/Ours styling and E2 personal ownership styling.
- Does not recolour generic buttons, navigation or controls.

INSTALL
1. Extract this ZIP into the Togetherly project root:
   C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

2. Run:
   cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
   node APPLY_RELEASE_E3_PAIRED_COUPLE_IDENTITY.js

VALIDATION
The installer automatically runs:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

Do not run expo lint.
No database migration is required.

The installer is Windows CRLF-safe for modified source files and computes all patches before writing them, preventing half-applied releases if an anchor is missing.
