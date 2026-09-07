# Togetherly Xcode 26 / Swift 6.2 hotfix

The GitHub build was pinned to Xcode 16.4, whose installed Swift toolchain is 6.1.
The current `expo-modules-jsi/apple` package requires Swift tools 6.2, so SwiftPM stops with:

`package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0`

This hotfix:

- moves the job from `macos-15` to `macos-26`;
- selects Xcode 26.6 explicitly;
- prints `swift --version` in diagnostics;
- fails early if Swift is older than 6.2;
- preserves the Watch platform repair step;
- changes the workflow's default bundle ID to `com.jlenteprises.togetherly`.

Apply over the current project, commit `.github`, push, then run the workflow again.
