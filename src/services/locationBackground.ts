import * as TaskManager from 'expo-task-manager';
import tzlookup from 'tz-lookup';
import { sendLivePosition } from '@/services/backend/location';
import { ensureStoredSession } from '@/services/backend/api';

export const LOCATION_TASK = 'togetherly-live-location';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations?: Array<{ coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }> }).locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  const session = await ensureStoredSession().catch(() => null);
  if (!session) return;
  const timezone = tzlookup(latest.coords.latitude, latest.coords.longitude);
  await sendLivePosition({
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracyM: latest.coords.accuracy,
    capturedAt: new Date(latest.timestamp).toISOString(),
    timezone,
  }).catch(() => undefined);
});
