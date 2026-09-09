Togetherly v1.14.3 — Release D9: Shared Celebrations

Goal
Make meaningful couple moments feel emotionally rewarding instead of silently changing state.

Adds a reusable celebration layer with:
- animated scale/spark motion using React Native Animated
- success haptic feedback when haptics are enabled
- optional action button
- automatic dismissal for passive wins
- no new dependency

D9 intentionally celebrates only meaningful moments:
1. Completing a task
2. Reaching or manually completing a shared goal
3. Revealing both Daily Question answers
4. Mutual Date Idea match

Date Idea matches keep their direct “Plan it” action inside the celebration.

Decision Wheel is intentionally excluded because it already has its own full spin animation and result reveal.

Files added
- src/hooks/useCelebrationMoment.ts
- src/components/common/CelebrationMoment.tsx

Screens updated
- src/app/features/tasks.tsx
- src/app/features/goals.tsx
- src/app/features/daily-question.tsx
- src/app/features/activities.tsx

Database
- No migration.
- No new dependency.

Apply
1. Extract this package into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D9_SHARED_CELEBRATIONS.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
