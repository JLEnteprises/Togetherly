Togetherly v1.14.3 — Release D16: Language & Interaction Consistency

Goal
Make the remaining practical screens sound and behave like one Togetherly product instead of a collection of separate tools.

This release intentionally changes copy and action naming only. It does not alter persistence, schemas, realtime behavior or business logic.

Tasks
- Warmer header: what needs doing, who has it, what matters next.
- “SHARED TASKS” hero becomes “WHAT NEEDS DOING”.
- New-task sheet becomes “Add something to do”.
- “New task” becomes “Add task”.
- Filters use simpler WHAT / WHO labels.
- Overflow menu no longer says “Manage this task”; it uses the same “Choose what to do.” pattern as other records.

Goals
- Warmer shared-goal header.
- “New goal” / “Create goal” become “Add goal”.
- Editing consistently uses “Save changes”.
- Progress-history explanation is conversational instead of implementation-like.
- Overflow menu uses the shared “Choose what to do.” pattern.

Lists
- Removes repetitive “shared lists” subtitle.
- “New/Create list” becomes “Add list”.
- Loading action becomes “Adding…”.
- List completion reads “X of Y done” instead of “X/Y completed”.

Availability
- “Schedules & overlap” becomes “When are we both free?”
- “My recurring schedule” becomes “My usual week”.
- “Schedule window” becomes human language such as “time”.
- “Add window” becomes “Add time”.
- Empty/no-overlap states are rewritten conversationally.
- Edit/delete menu uses the same shared record action language.

Notes
- Overflow menu uses the same “Choose what to do.” interaction language.
- “New note” becomes “Add note” when that baseline is present.

Technical scope
- src/app/features/tasks.tsx
- src/app/features/goals.tsx
- src/app/features/lists.tsx
- src/app/features/availability.tsx
- src/app/features/notes.tsx
- No backend changes.
- No migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D16_LANGUAGE_CONSISTENCY.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
