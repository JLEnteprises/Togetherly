import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Watch support must never be required for the phone app to boot.
 * Expo returns null when the native module was not linked/loaded, allowing
 * callers to fall back cleanly instead of throwing during module import.
 */
const TogetherlyWatchBridge = requireOptionalNativeModule('TogetherlyWatchBridge');

export default TogetherlyWatchBridge;
