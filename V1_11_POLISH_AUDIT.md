# v1.11 Product Polish Audit

## Product rule

Togetherly should be feature-rich underneath but quiet in everyday use. Default screens surface the thing a couple needs now; deeper controls remain available without being explained constantly.

## Improvements made

### Live location
- Replaced the blank-map state with a deliberate empty state.
- Live status now ages on screen without waiting for another GPS event.
- Distance is human-readable at short and long ranges.
- The map follows meaningful position changes and can keep both partners visible.
- Web no longer exposes raw coordinate numbers as a fallback.
- Background updates restore authentication before contacting the API.

### Timezone
- Automatic really means automatic: with permission already granted, Togetherly can refresh timezone when the app returns to the foreground even when live sharing is off.
- Location sharing and automatic timezone remain separate choices.
- Manual mode continues to use the searchable timezone picker and is never overwritten by location updates.

### Tasks
- Checklist steps can now be included while initially creating a task.
- Step due dates and durations remain available.
- Parent/step date validation happens before creation.
- Smart Now/Open/All/Done behaviour remains unchanged.

### Navigation
- Together: Location merged into Connect.
- Plan: Tags merged into Organise.
- More: removed duplicated relationship/timezone summary and the one-item Find group.
- Updated stale breadcrumb labels so screens point back to their current parent area.

### Copy
- Removed development-facing and generated-sounding explanations.
- Shortened game descriptions and onboarding helper text.
- Preserved copy that communicates real privacy, permission or destructive-action consequences.

### Cleanup
Eight obsolete Home preview components from the old dashboard architecture were removed. Their user-facing functions already live in the consolidated Today / Long Distance / Scratchpad Home cards, so no feature was lost.

## What was deliberately not changed

- Home structure remains Couple hero → Today → Scratchpad → conditional Long Distance → Quick Actions.
- Photos and Albums remain one Photos destination with All / Albums views.
- Existing games, planning tools, Memories, Notes, Calendar, Availability, Trips and Goals remain intact.
- v1.11 adds no migration and no dependency.
