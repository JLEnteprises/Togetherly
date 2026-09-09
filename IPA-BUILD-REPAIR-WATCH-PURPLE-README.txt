Togetherly v1.14.3 — IPA Build Repair: Watch Purple

Build failure
The GitHub Actions IPA build failed in the TogetherlyWatch target:

TogetherlyWatchHome.swift:215:52
error: cannot find 'purple' in scope

Broken source:
  .tint(mood == item.0 ? purple : .gray)

Why
TogetherlyWatchHome.swift does not define a variable named `purple`.

The same file already defines:
  identityColor(_:)

and maps the legacy participant color name "purple" to the correct Togetherly purple.

Repair
The broken expression is changed to:

  .tint(mood == item.0 ? identityColor("purple") : .gray)

This reuses the Watch target's existing participant-color implementation rather than adding another color constant.

The other log lines shown in the failed build are warnings, including:
- ExpoModulesJSI annotation warning
- react-native-safe-area-context field-order warning
- unused apiURL/watchToken warnings

They did not stop this build.

Validation
The repair runs:
- frontend TypeScript
- server TypeScript
- server logic smoke checks

Swift/watchOS compilation itself happens on the macOS GitHub Actions runner when you rebuild the IPA.

Apply
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

node APPLY_IPA_BUILD_REPAIR_WATCH_PURPLE.js

After it passes, commit and push the repair, then rerun the IPA build.
