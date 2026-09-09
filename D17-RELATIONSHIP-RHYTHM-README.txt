Togetherly v1.14.3 — Release D17: Relationship Rhythm

Goal
Finish the Home/Together ritual audit so the app’s emotional features feel like one continuous relationship rhythm rather than separate tools.

Key finding
Home had the stronger quick-connection ritual:
- Love Tap
- Thinking of you
- Mood check-in

Together separately rendered another Love/Thinking card, then routed Mood elsewhere.

D17 removes that duplicate experience and makes the SAME connection actions appear on Home and Together.

Together becomes the shared lounge
Order becomes:
1. Partner presence in the Together tab
2. Between you:
   - Love Tap
   - Thinking of you
   - How I’m feeling
3. Check in together:
   - Today’s Question
   - Mood
   - Live Location
4. Play Together
5. Date Ideas

Presence
- Together now claims ephemeral scope: together
- If both partners are on the Together tab, the existing presence pill shows that they are there together.
- Opening a more specific shared space such as a game still overrides this with the newer exact presence claim.
- No presence history is stored.

Home
The emotional priority stays exactly where it belongs:
- partner needs support
- Daily Question ready to reveal
- unanswered Daily Question

But the lower practical summary changes from:
“Today — A short view of what needs your attention.”

to:
“Life today — The practical bits around your day.”

That gives Home a clearer rhythm:
- Right now = relationship priority
- Between you = instant connection
- Life today = practical life
- Long Distance = distance/reunion context

Quick Mood copy
The Home/Together quick mood action now reads:
- “How I’m feeling”
- “Share with <partner>”

The sheet explains the relationship purpose rather than pointing users toward another product feature.

Technical scope
- src/components/dashboard/HomeConnectionActions.tsx
- src/components/dashboard/HomeTodayCard.tsx
- src/app/(tabs)/together.tsx
- Reuses existing presence infrastructure.
- Removes Together’s duplicate ConnectionPingsCard usage; the component file itself is left untouched for safety.
- No backend changes.
- No migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D17_RELATIONSHIP_RHYTHM.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic

After D17
The remaining definite roadmap step is D18: full-app UX regression and hardening.
A D19 should only exist if D18 finds enough real issues to justify a separate repair/polish release.
