Togetherly v1.14.3 — Release D6: Date Matches

Purpose
- Give shared Date Ideas an emotional payoff when both partners say they are interested.
- Surface mutual matches instead of hiding them in a small status caption.
- Let either partner jump directly from a match into planning it on Calendar.

Changes
- Adds a Matches ❤️ filter to Date Ideas.
- Adds a relationship-first mutual-match hero card.
- Shows ❤️ MATCH clearly on mutually-liked date ideas.
- When the second partner taps Interested, shows an immediate “It’s a match ❤️” moment.
- The match dialog can open Calendar with the activity prefilled.
- Keeps existing activity storage, per-user interest votes, realtime refresh, randomiser, favourites, statuses, and editing.

Database
- No migration.
- No new dependency.

Apply
1. Put APPLY_RELEASE_D6_DATE_MATCHES.js in the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D6_DATE_MATCHES.js

The installer runs:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
