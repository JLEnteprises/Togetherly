# Evening Journal visual refresh

The shared UI now uses deep ink surfaces, cream text and warm peach actions. Participant colours continue to identify ownership; they are not replaced by the brand colour.

## Design decisions

- Native serif display titles (Georgia on iOS/web; system serif on Android) paired with system sans-serif body text. No font download or startup dependency.
- Original responsive SVG chapter illustrations for Home, Plan, Connect and Our Story. Illustrations are decorative, non-interactive and excluded from accessibility navigation.
- Softer ambient radial glows retain backdrop variants and reduced-motion behaviour.
- Shared card, button, icon button, field and empty-state styling updates feature screens throughout the app.
- Active navigation has a visible pill and heavier icon stroke; Home uses a recognisable house symbol.
- Inputs visibly indicate focus without replacing consumer focus/blur callbacks.
- Maximum reading width is 880 points. Display titles wrap, and illustration height does not depend on text length.

## Validation

TypeScript and Expo web export pass locally. Representative normal text/background contrast pairs range from 5.57:1 to 14.41:1; the primary button pair is 11.53:1. These checks cover the new common palette, not every user-selected participant colour.

The cloud browser could not reach the local preview (ERR_BLOCKED_BY_CLIENT). Visual checks on a device remain outstanding: 320-point width, long partner names, large accessibility text, keyboard/form focus, all four tabs, high contrast, backdrop choices and reduced motion.

No route, feature, data schema or backend behaviour changes are included.
