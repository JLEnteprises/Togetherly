Togetherly v1.14.3 — D6 Date Matches Repair

Fixes the TypeScript errors caused by directly indexing mutualMatches[0].

The repair:
- derives `topMatch = mutualMatches[0] ?? null`
- renders the match hero only when topMatch exists
- uses topMatch for title, planning, and detail actions
- reruns frontend typecheck, server typecheck, and server logic checks

No migration is required.

Run:
  node APPLY_RELEASE_D6_DATE_MATCHES_REPAIR.js
