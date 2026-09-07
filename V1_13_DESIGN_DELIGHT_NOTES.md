# Togetherly v1.13 — Design & Delight Notes

## Product direction

v1.13 deliberately adds very little feature breadth. The goal is to make Togetherly feel like a private digital home for two people rather than a collection of shared utilities.

The hierarchy is now:
- **Home** — what matters between us right now;
- **Plan** — what we're organising;
- **Together** — live interaction, feeling and play;
- **Us** — relationship history and emotional payoff;
- **More** — settings and low-frequency administration.

## Key UX changes

- Home can prioritise partner emotional needs and a Daily Question ready to reveal over routine planning summaries.
- Together leads with Daily Question and Mood before optional location sharing.
- Us is increasingly driven by real relationship data, memories, photos, milestones and On This Day.
- Tags are kept out of primary Plan navigation and managed from More.
- Secondary management actions across dense feature cards are moved behind a consistent overflow action.
- Scratchpad is positioned as quick/casual shared space; Notes as writing worth keeping.
- Mood starts unselected and supports a lightweight partner acknowledgement.
- Daily Question gets a deliberate reveal beat after both people are ready.
- Invite codes have explicit Copy and Share actions.

## Visual system

- deeper near-black cosmic base;
- participant purple + green remain the semantic identity colours;
- custom line icon system replaces platform-dependent structural Unicode glyphs;
- orbit/connection motifs represent two independent people sharing one space;
- branded app icon, adaptive icon, splash and favicon use the same language;
- flatter default cards, less shadow and less nested elevation;
- primary buttons are visually dominant, secondary actions quieter, administration hidden unless requested.

## Motion system

Motion is purposeful rather than decorative:
- fade/rise for content arrival;
- reveal scale for relationship reward moments;
- gentle float/ambient movement for cosmic artwork;
- pressed-state scale/haptic feedback for tactile controls;
- Reduced Motion preference suppresses or calms nonessential movement.

## Infrastructure deliberately not faked

v1.13 does not pretend that native APNs/FCM delivery or scalable object-photo storage are complete. Those require real external service/deployment choices and credentials. The source package leaves those as explicit next integrations rather than burying fake implementations behind polished UI.
