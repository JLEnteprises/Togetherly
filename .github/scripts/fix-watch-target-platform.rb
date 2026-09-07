#!/usr/bin/env ruby
# Repairs @bacons/apple-targets Watch target platform settings after Expo prebuild.
# This is intentionally run after `pod install`, before xcodebuild.

require 'xcodeproj'

root = ENV['GITHUB_WORKSPACE'] || File.expand_path('../..', __dir__)
projects = Dir[File.join(root, 'ios', '*.xcodeproj')].reject { |p| File.basename(p) == 'Pods.xcodeproj' }
abort 'No app .xcodeproj found under ios/' if projects.empty?

project_path = projects.first
project = Xcodeproj::Project.open(project_path)

watch_targets = {
  'TogetherlyWatch' => '10.0',
  'TogetherlyWatchWidget' => '10.0',
}

missing = []
watch_targets.each do |name, deployment|
  target = project.targets.find { |t| t.name == name }
  unless target
    missing << name
    next
  end

  target.build_configurations.each do |config|
    settings = config.build_settings
    settings['SDKROOT'] = 'watchos'
    settings['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
    settings['WATCHOS_DEPLOYMENT_TARGET'] = deployment
    settings['TARGETED_DEVICE_FAMILY'] = '4'
    settings['SUPPORTS_MACCATALYST'] = 'NO'
    settings['SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'
    settings.delete('IPHONEOS_DEPLOYMENT_TARGET')
  end
end

unless missing.empty?
  warn "Missing expected Watch targets: #{missing.join(', ')}"
  warn "Available targets: #{project.targets.map(&:name).join(', ')}"
  exit 1
end

project.save

puts "Repaired Watch platform settings in #{project_path}"
watch_targets.each_key do |name|
  target = project.targets.find { |t| t.name == name }
  puts "#{name}:"
  target.build_configurations.each do |config|
    s = config.build_settings
    puts "  #{config.name}: SDKROOT=#{s['SDKROOT']} SUPPORTED_PLATFORMS=#{s['SUPPORTED_PLATFORMS']} WATCHOS_DEPLOYMENT_TARGET=#{s['WATCHOS_DEPLOYMENT_TARGET']} TARGETED_DEVICE_FAMILY=#{s['TARGETED_DEVICE_FAMILY']}"
  end
end
