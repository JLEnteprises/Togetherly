export type PushPermission = 'granted' | 'denied' | 'undetermined';
export type PushStatus = {
  supported: boolean;
  permission: PushPermission;
  token: string | null;
  registered: boolean;
  reason?: string;
};

const unsupported: PushStatus = {
  supported: false,
  permission: 'undetermined',
  token: null,
  registered: false,
  reason: 'Device push is available in the native Togetherly app.',
};

// Metro resolves pushNotifications.native.ts on iOS/Android and
// pushNotifications.web.ts on web. This base module keeps tsc platform-neutral.
export async function getPushStatus(): Promise<PushStatus> { return unsupported; }
export async function enablePushNotifications(): Promise<PushStatus> { return unsupported; }
export async function syncPushRegistrationIfGranted(): Promise<PushStatus> { return unsupported; }
export async function disablePushNotifications(): Promise<PushStatus> { return unsupported; }
export async function deactivatePushBeforeSignOut(): Promise<void> { return; }
export async function forgetLocalPushRegistration(): Promise<void> { return; }
export function subscribeToPushInteractions(_onHref: (href: string) => void): () => void { return () => undefined; }
