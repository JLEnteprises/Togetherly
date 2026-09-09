import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'togetherly:first-time-guide:v1:';

function keyFor(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

// F1_FIRST_TIME_USER_GUIDANCE: a local pending flag means existing users are not opted into new-user guidance after an upgrade.
export async function queueFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), 'pending');
}

export async function shouldShowFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return false;
  return (await AsyncStorage.getItem(keyFor(userId))) === 'pending';
}

export async function dismissFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), 'dismissed');
}
