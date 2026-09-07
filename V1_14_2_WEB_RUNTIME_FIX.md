# Togetherly v1.14.2 — Web Runtime Hotfix

This hotfix removes React-Native-only accessibility props from the decorative `react-native-svg` AppIcon root. On React Native Web, `importantForAccessibility` was forwarded to the browser `<svg>` node and React reported it as an invalid DOM property.

## Fixed
- removed `importantForAccessibility` from `AppIcon`;
- removed `accessibilityElementsHidden` from the same decorative SVG root;
- scanned the project for any additional occurrences of those props on SVG components: none remain;
- bumped root/app/server test version to `1.14.2`.

No dependency, database, or API changes are required. Existing v1.14.1 `node_modules`, database, and `.env` files can be reused.
