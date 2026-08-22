# Togetherly — Purple / Green Participant Identity

Purple and Green represent the **two people**, not generic application states.

## Assignment

- The account that creates a couple space chooses either Purple or Green during onboarding.
- The partner who joins receives the other colour automatically.
- Both devices receive the same membership mapping from the server.
- Existing upgraded couples preserve their previous membership colours.

## Usage

Use participant colour for identity-bearing information such as:

- avatar borders
- creator/author attribution
- task/event assignees
- contributions
- notification actors
- scratchpad last editor
- memory/activity ownership

Shared/both-person content can use a dual treatment.

The surrounding app stays predominantly neutral/dark so participant colour remains meaningful rather than decorative noise.

## Names first

Where a person is being identified, show their actual display name. Do not present account identity as `You`, `Partner`, `Purple person`, or `Green person` when a profile name is available.

Colour supplements the name; it does not replace it. Accessibility/state meaning must never rely on colour alone.

## Changing colours

- A single unpaired account may choose Purple or Green.
- Once both people are linked, changing one colour independently is blocked because the two colours must stay unique.
- **Swap our colours** atomically swaps both memberships and stored colour preferences.
