Togetherly v1.14.3 — Release F1: First-Time User Guidance
==========================================================

PURPOSE
-------
F1 adds lightweight guidance immediately after a genuinely new account finishes onboarding.
It does not add another setup wizard and it does not rewrite empty states (that is F2).

WHAT CHANGES
------------
1. Onboarding queues a local one-time Home guide only when onboarding is actually completed.
2. Existing already-completed accounts are not automatically opted into the guide after upgrading.
3. Home shows a "New here" guide while that per-profile local flag is pending.
4. If the partner has not joined yet, the guide explains the Together / Plan / Us mental model while the invite card remains the required next step.
5. Once the partner is linked, the guide offers three direct starter actions:
   - Today's question -> Together
   - Add a task -> Plan
   - Add a memory -> Us
6. "Got it" dismisses the guide persistently for that local profile.

FILES
-----
Added:
- src/services/firstTimeGuide.ts
- src/components/dashboard/FirstTimeGuideCard.tsx

Updated:
- src/app/(onboarding)/index.tsx
- src/app/(tabs)/index.tsx

APPLY FROM WINDOWS COMMAND PROMPT
---------------------------------
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_F1_FIRST_TIME_USER_GUIDANCE.js

AUTOMATIC VALIDATION
--------------------
The installer runs:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

The patcher is CRLF/LF safe, precomputes all outputs before writing, and is idempotent.

NO MIGRATION / NO DEPENDENCY CHANGE
-----------------------------------
F1 uses the AsyncStorage dependency already present in Togetherly.
No database migration, server schema change, package install, or version bump is required.
Do not run expo lint for this release.

EXPECTED SUCCESS
----------------
[F1] ALL VALIDATIONS PASSED
