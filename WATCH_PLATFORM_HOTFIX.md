# Togetherly Watch platform hotfix

The GitHub build log showed `TogetherlyWatchWidget` compiling as `arm64-apple-ios16.4` / `Release-iphoneos`, even though it is a watchOS complication target. The Swift source uses WidgetKit APIs that are valid on watchOS 10 but require iOS 17 when compiled as an iOS app extension.

This overlay adds a post-prebuild Xcode-project repair that forces both generated Watch targets to use:

- `SDKROOT = watchos`
- `SUPPORTED_PLATFORMS = watchos watchsimulator`
- `WATCHOS_DEPLOYMENT_TARGET = 10.0`
- `TARGETED_DEVICE_FAMILY = 4`

The workflow runs the repair after CocoaPods and before the unsigned Xcode build, and prints the resulting settings so the CI log proves which platform Xcode will use.
