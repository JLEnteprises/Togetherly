# Togetherly Release A — Identity & Design Foundation (Part 1)

This is the first implementation stage of the UX plan.

## What this changes

- Replaces the fixed Purple/Green participant type with stored `#RRGGBB` identity colours.
- Preserves existing Purple/Green couples exactly by migrating them to `#BE9AFF` and `#B7CB7C`.
- Adds a reusable colour picker with 12 presets plus custom `#RRGGBB` input.
- Both the couple creator and the joining partner choose their own colour.
- Warns/rejects identity colours that are too visually similar.
- Lets each user change their own identity colour later from Settings → Appearance.
- Makes Togetherly's ordinary controls neutral instead of borrowing the signed-in user's colour.
- Reserves participant colours for identity/ownership and dual-colour "us" treatments.
- Upgrades shared cards so "both" uses the actual two chosen colours.
- Upgrades attribution to include a small identity marker plus the person's name.
- Makes couple artwork/orbits use the couple's real chosen colours.
- Updates Watch + Watch widgets + iPhone widgets to decode arbitrary hex participant colours.
- Includes the previously discussed false Shared Note stale-edit timestamp hotfix.
- Adds migration `013_custom_participant_colors.sql`.

## Apply

Extract this ZIP into the project root, then from:

`C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere`

run:

```cmd
node APPLY_RELEASE_A_IDENTITY.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd run backend:migrate
```

Do not build the IPA until the typechecks and migration pass.

## Important

This is the identity/design *foundation*. It deliberately centralizes the colour meaning first. The next Release A pass can use that system to simplify individual screens and strengthen "me / partner / us" presentation without rewriting the data model again.

The installer writes `RELEASE_A_IDENTITY_REMAINING.txt` only if it detects source files that still contain hard-coded Purple/Green assumptions. If that file appears, keep it and share its contents before the next pass.
