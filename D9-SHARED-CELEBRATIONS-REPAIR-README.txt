Togetherly v1.14.3 — D9 Shared Celebrations Repair

Why this repair exists
The original D9 installer successfully wrote:
- useCelebrationMoment.ts
- CelebrationMoment.tsx
- Tasks celebration integration
- Goals celebration integration
- Daily Question celebration integration

It stopped only when patching Date Ideas because activities.tsx uses a compact direct JSX return:
  </AppScreen>;

The original installer expected a different multiline close pattern.

This repair:
- leaves the already-applied D9 files intact
- adds the missing Date Ideas CelebrationMoment import
- adds useCelebrationMoment to Date Ideas
- replaces the old “It’s a match ❤️” Alert with the animated celebration
- preserves the direct Plan it action
- inserts the celebration renderer using the actual compact AppScreen close
- audits all D9 integrations
- reruns all three validation checks

No migration.
No new dependency.

Run:
  node APPLY_RELEASE_D9_SHARED_CELEBRATIONS_REPAIR.js
