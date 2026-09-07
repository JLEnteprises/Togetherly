const staticConfig = require('./app.json').expo;

const bundleIdentifier = process.env.TOGETHERLY_BUNDLE_ID?.trim() || process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() || staticConfig.ios.bundleIdentifier || 'com.example.togetherly';
const androidPackage = process.env.TOGETHERLY_ANDROID_PACKAGE?.trim() || process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() || bundleIdentifier;
const appGroup = `group.${bundleIdentifier}.shared`;
const appleTeamId = process.env.APPLE_TEAM_ID?.trim() || process.env.EXPO_PUBLIC_APPLE_TEAM_ID?.trim();
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();

module.exports = {
  expo: {
    ...staticConfig,
    ios: {
      ...staticConfig.ios,
      bundleIdentifier,
      ...(appleTeamId ? { appleTeamId } : {}),
      entitlements: {
        ...(staticConfig.ios.entitlements || {}),
        'com.apple.security.application-groups': [appGroup],
      },
    },
    android: {
      ...staticConfig.android,
      package: androidPackage,
    },
    extra: {
      ...(staticConfig.extra || {}),
      eas: {
        ...(staticConfig.extra?.eas || {}),
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },
  },
};
