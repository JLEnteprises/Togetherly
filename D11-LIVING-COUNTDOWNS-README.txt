Togetherly v1.14.3 — Release D11: Living Countdowns

Goal
Finish the playful/microinteraction roadmap slice by making important countdowns feel emotionally alive instead of like static records.

What changes
- The nearest upcoming countdown becomes the lead emotional card.
- Conversational timing states:
  • Today ♥
  • Tomorrow ♥
  • “X days — so close now ♥”
  • “X days until …”
- Day changes trigger a gentle RevealScale update.
- The lead icon/orbit gently moves using Togetherly’s existing reduced-motion-aware motion components.
- If a start date exists, the lead card says how much of the wait is already behind you.
- Other countdowns remain listed underneath.
- The detail sheet gets the same conversational countdown language and progress.
- Create/edit/delete/view behavior remains unchanged.

Accessibility
- Uses Togetherly’s existing motion primitives, which already respect reduced-motion settings.

Technical scope
- One screen only: src/app/features/countdowns.tsx
- No backend changes.
- No database migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D11_LIVING_COUNTDOWNS.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
