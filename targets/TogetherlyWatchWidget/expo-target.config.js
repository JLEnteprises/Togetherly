/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',
  name: 'TogetherlyWatchWidget',
  displayName: 'Togetherly',
  deploymentTarget: '10.0',
  bundleIdentifier: '.watchkitapp.widget',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'Foundation'],
  colors: {
    $accent: '#9B6AF5',
    $widgetBackground: '#0B0A0F',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
