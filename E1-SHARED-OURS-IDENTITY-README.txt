TOGETHERLY v1.14.3 — RELEASE E1
SHARED / OURS VISUAL IDENTITY

Purpose
-------
Make couple-owned content read as "ours" at a glance without inventing a third participant colour.

What this release changes
-------------------------
1. Strengthens Card participantColor="both":
   - keeps the existing left/right participant-colour borders
   - adds a subtle two-sided participant-colour wash
   - adds a paired top identity rail

2. Strengthens ParticipantIdentityBadge both:
   - keeps overlapping participant avatars
   - adds a two-sided participant-colour wash
   - keeps each person's real configured colour
   - changes the shared label from "US" to "OURS"

Because these are shared primitives, the treatment automatically reaches existing shared surfaces that already use them, including shared tasks, goals, and memories, without individually restyling every screen.

No database migration is required.
No new dependency is required.
Do NOT run expo lint for this release.

Install
-------
From PowerShell:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_E1_SHARED_OURS_IDENTITY.js

The installer runs:
- frontend TypeScript
- server TypeScript
- server logic smoke checks

If all validations pass, checkpoint with:

git add .
git commit -m "Make shared ownership visually distinct"
git push

Then reply: done
