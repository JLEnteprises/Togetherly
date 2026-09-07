export type PushPermission = 'granted' | 'denied' | 'undetermined';
export type PushStatus = { supported: boolean; permission: PushPermission; token: string | null; registered: boolean; reason?: string };
const unsupported: PushStatus = { supported: false, permission: 'undetermined', token: null, registered: false, reason: 'Device push is available in the native Togetherly app.' };
export async function getPushStatus() { return unsupported; }
export async function enablePushNotifications() { return unsupported; }
export async function syncPushRegistrationIfGranted() { return unsupported; }
export async function disablePushNotifications() { return unsupported; }
export async function deactivatePushBeforeSignOut() { return; }
export async function forgetLocalPushRegistration() { return; }
export function subscribeToPushInteractions(_onHref: (href: string) => void) { return () => undefined; }
