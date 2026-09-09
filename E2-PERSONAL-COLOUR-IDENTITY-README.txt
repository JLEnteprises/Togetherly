Togetherly v1.14.3 — Release E2: Personal Colour Identity

PURPOSE
Make personal ownership more visually obvious across major Togetherly feature screens
without turning the app itself into participant colours.

WHAT CHANGES
1. Individual owner-aware Card surfaces
   - keep the existing 4px participant-colour ownership edge
   - add a restrained full-card participant tint
   - add a short top identity rail in that participant's actual colour

2. ParticipantAttribution
   - known creators now appear in a compact participant-colour pill
   - the initial dot gets a clearer participant-colour outline
   - previous/unknown members remain neutral

WHERE THIS PROPAGATES
Because Togetherly already passes participant ownership into common primitives, E2
automatically strengthens identity on surfaces such as:
- Tasks
- Calendar events
- Availability schedules
- other owner-aware cards/creator attribution already using these components

GUARDRAILS
- E1 Shared/Ours two-colour treatment is preserved.
- Generic buttons, navigation, inputs and neutral app controls are not recoloured.
- No database migration.
- No dependencies.
- No app version bump.

INSTALL
Extract this ZIP into the Togetherly project root, then run:

  cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
  node APPLY_RELEASE_E2_PERSONAL_COLOUR_IDENTITY.js

VALIDATION
The installer automatically runs:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

Do NOT run expo lint for this release.

WINDOWS SAFETY
The installer matches source using normalized line endings but writes each source file
back with the same CRLF/LF style it started with. npm commands run through cmd.exe on
Windows to avoid the historical spawnSync('npm.cmd') EINVAL issue.
