import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deactivatePushToken, registerPushDevice } from '@/services/backend/mvpFeatures';

const STORAGE_KEY = 'togetherly.push.registration.v1';
const CHANNEL_RELATIONSHIP = 'relationship';
const CHANNEL_PLANNING = 'planning';
const CHANNEL_GENERAL = 'general';

export type PushPermission = 'granted' | 'denied' | 'undetermined';
export type PushStatus = {
  supported: boolean;
  permission: PushPermission;
  token: string | null;
  registered: boolean;
  reason?: string;
};

type StoredPushRegistration = { token: string; platform: 'ios' | 'android'; userId?: string | null };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function readStored(): Promise<StoredPushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredPushRegistration : null;
  } catch { return null; }
}

async function writeStored(value: StoredPushRegistration | null) {
  try {
    if (value) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch { /* best effort */ }
}

function normalizePermission(status: Notifications.PermissionStatus): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

function projectId() {
  const constants = Constants as typeof Constants & { easConfig?: { projectId?: string } };
  return constants.expoConfig?.extra?.eas?.projectId
    ?? constants.easConfig?.projectId
    ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
    ?? null;
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_RELATIONSHIP, {
    name: 'Love & connection',
    description: 'Love taps, thinking-of-you notes, check-ins and Daily Question moments.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 160, 90, 160],
    lightColor: '#9B6AF5',
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_PLANNING, {
    name: 'Plans & reminders',
    description: 'Tasks, events, visits, goals and countdown reminders.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_GENERAL, {
    name: 'Togetherly',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function expoToken() {
  const id = projectId();
  if (!id) throw new Error('EAS project ID is not configured yet. Run “eas init” and rebuild Togetherly.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return token.data;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { supported: false, permission: 'undetermined', token: null, registered: false, reason: 'Push notifications are available on iPhone and Android.' };
  if (!Device.isDevice) return { supported: false, permission: 'undetermined', token: null, registered: false, reason: 'Remote push notifications require a physical device.' };
  const permission = normalizePermission((await Notifications.getPermissionsAsync()).status);
  const stored = await readStored();
  return { supported: true, permission, token: stored?.token ?? null, registered: Boolean(stored?.token) };
}

async function registerCurrentToken() {
  await configureAndroidChannels();
  const token = await expoToken();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = Device.deviceName ?? Device.modelName ?? (platform === 'ios' ? 'iPhone' : 'Android device');
  await registerPushDevice({ token, platform, deviceName });
  await writeStored({ token, platform });
  return token;
}

export async function enablePushNotifications(): Promise<PushStatus> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return getPushStatus();
  await configureAndroidChannels();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (permission.status !== 'granted') {
    return { supported: true, permission: normalizePermission(permission.status), token: null, registered: false, reason: 'Notification permission is off in system settings.' };
  }
  const token = await registerCurrentToken();
  return { supported: true, permission: 'granted', token, registered: true };
}

export async function syncPushRegistrationIfGranted(): Promise<PushStatus> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return getPushStatus();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return getPushStatus();
  try {
    const token = await registerCurrentToken();
    return { supported: true, permission: 'granted', token, registered: true };
  } catch (error) {
    const stored = await readStored();
    return { supported: true, permission: 'granted', token: stored?.token ?? null, registered: Boolean(stored?.token), reason: error instanceof Error ? error.message : 'Could not register this device.' };
  }
}

export async function disablePushNotifications() {
  const stored = await readStored();
  if (stored?.token) await deactivatePushToken(stored.token).catch(() => undefined);
  await writeStored(null);
  return getPushStatus();
}

export async function deactivatePushBeforeSignOut() {
  const stored = await readStored();
  if (stored?.token) await deactivatePushToken(stored.token).catch(() => undefined);
  await writeStored(null);
}

export async function forgetLocalPushRegistration() { await writeStored(null); }

export function subscribeToPushInteractions(onHref: (href: string) => void) {
  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const href = event.notification.request.content.data?.href;
    if (typeof href === 'string' && href.startsWith('/')) onHref(href);
  });
  const token = Notifications.addPushTokenListener(() => {
    syncPushRegistrationIfGranted().catch(() => undefined);
  });
  Notifications.getLastNotificationResponseAsync().then((event) => {
    const href = event?.notification.request.content.data?.href;
    if (typeof href === 'string' && href.startsWith('/')) onHref(href);
  }).catch(() => undefined);
  return () => { response.remove(); token.remove(); };
}
