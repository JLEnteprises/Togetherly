Togetherly v1.14.3 — Release F2: Empty-State Coaching
=====================================================

What F2 does
------------
F2 makes empty screens useful instead of merely empty.

It upgrades the shared EmptyState component with:
- a consistent eyebrow/context label
- an optional concrete “Try this” coaching block
- primary and optional secondary actions
- the existing Togetherly visual hierarchy from E4

It applies coached empty states to:
- Tasks
- Notes
- Memories
- Date Ideas
- Shared Goals
- Trips

Filtered empty views now provide a direct “show all” recovery action.
Brand-new empty views suggest one small, realistic first item instead of asking users to invent a whole system from scratch.

Install (Windows Command Prompt)
--------------------------------
1. Extract this ZIP into the Togetherly project root:
   C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

2. Run:
   cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
   node APPLY_RELEASE_F2_EMPTY_STATE_COACHING.js

The installer automatically runs the trusted checks:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

No migration is required.
Do not run expo lint.

Safety / installer behaviour
----------------------------
- CRLF/LF safe on Windows
- all patch outputs are calculated before any source file is written
- installer is idempotent via the F2_EMPTY_STATE_COACHING marker
- prior E1–E4 and F1 markers are audited as guardrails
- no dependencies, schema changes, server changes, or version bump
