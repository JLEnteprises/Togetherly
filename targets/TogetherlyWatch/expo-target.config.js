/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'TogetherlyWatch',
  displayName: 'Togetherly',
  deploymentTarget: '10.0',
  bundleIdentifier: '.watchkitapp',
  icon: '../../assets/images/icon.png',
  frameworks: ['SwiftUI', 'Foundation', 'WatchConnectivity', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
