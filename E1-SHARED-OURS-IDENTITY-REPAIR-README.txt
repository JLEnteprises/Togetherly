Togetherly v1.14.3 — Release E1 Shared/Ours Visual Identity Repair

WHY THIS REPAIR EXISTS
The first E1 installer failed before writing source because its exact text anchor expected LF line endings.
Your Windows checkout uses CRLF line endings.

WHAT THIS REPAIR DOES
- Preserves the intended E1 Shared/Ours visual identity changes.
- Normalizes line endings only in memory while matching patch anchors.
- Restores each source file to its original LF/CRLF line-ending style when writing.
- Is safe to rerun if E1 is already present.
- Runs the trusted validation workflow:
  1. Frontend typecheck
  2. Server typecheck
  3. Server logic smoke checks

NO DATABASE MIGRATION IS REQUIRED.
DO NOT RUN expo lint.

RUN FROM POWERSHELL
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_E1_SHARED_OURS_IDENTITY_REPAIR.js
