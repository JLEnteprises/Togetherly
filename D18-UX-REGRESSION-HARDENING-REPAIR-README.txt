Togetherly v1.14.3 — D18 UX Regression & Hardening Repair

Why this repair exists
The original D18 installer successfully wrote all four intended source changes, then stopped during its own source audit.

The failure was NOT a Togetherly source-code failure.

The installer wrote this correct source:

  const isEditing = /^edit\b/i.test(title.trim());

But its audit marker accidentally searched for a representation containing an extra escaped backslash.

This repair:
- does not roll back the D18 source changes
- does not duplicate the patches
- validates the correctly patched source
- reruns the complete D18 roadmap regression audit
- runs frontend TypeScript
- runs frontend lint
- runs server TypeScript
- runs server logic smoke checks

Run from the Togetherly project root:

  node APPLY_RELEASE_D18_UX_REGRESSION_HARDENING_REPAIR.js

If this finishes successfully, D18 is clean and ready to commit.
