Togetherly v1.14.3 — Release D15: Lighter Navigation

Goal
Reduce card overload and make secondary navigation feel like part of a shared home rather than a grid of product modules.

Core change
FeatureGroupCard now has two visual roles:
- accent=true:
  keeps the intentional featured Card treatment
- default:
  becomes a lightweight section with simple navigation rows and separators

This means secondary navigation in Plan, Together, More, and places such as Notes no longer adds another heavy card container around every set of links.

Plan copy polish
- “Organise” -> “Day to day”
- “Dates & time” -> “Dates worth keeping”
- “Bigger plans” -> “Things you’re building toward”
- “Availability” -> “When are we both free?”
- subtitles are more conversational and less administrative

Together copy polish
- “Check in” -> “How are we?”
- “Daily question” -> “Today’s question”
- “Mood check-in” -> “How are you feeling?”
- Date Ideas section becomes “Pick a little moment together”

More copy polish
- “Manage” -> “Behind the scenes”
- “Couple profile” -> “Your relationship”
- management language is visually and verbally quieter

Interaction
- Entire rows remain tappable.
- Existing accessibility labels remain.
- Pressed rows get a subtle background response.
- Chevrons and icons remain.
- Featured/accent groups remain cards.

Technical scope
- src/components/navigation/FeatureGroupCard.tsx
- src/app/(tabs)/plan.tsx
- src/app/(tabs)/together.tsx
- src/app/(tabs)/more.tsx
- No backend changes.
- No migration.
- No new dependency.

Apply
1. Extract into the Togetherly project root.
2. Run:
   node APPLY_RELEASE_D15_LIGHTER_NAVIGATION.js

Validation runs automatically:
- npm.cmd run typecheck
- npm.cmd --prefix server run typecheck
- npm.cmd --prefix server run logic
