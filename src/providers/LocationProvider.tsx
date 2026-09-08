import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import tzlookup from 'tz-lookup';
import { LOCATION_TASK } from '@/services/locationBackground';
import { getLiveLocations, sendLivePosition, setLocationSharing } from '@/services/backend/location';
import { updateProfile } from '@/services/backend/workspace';
import { useWorkspace } from './WorkspaceProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { LiveLocationMember } from '@/types/database';

type ContextValue = {
  members: LiveLocationMember[];
  sharing: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setSharing: (enabled: boolean) => Promise<void>;
  refreshAutomaticTimezone: () => Promise<string | null>;
};

const Context = createContext<ContextValue | null>(null);
const AUTO_TIMEZONE_SYNC_MS = 15 * 60 * 1000;

export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile, couple, refresh: refreshWorkspace } = useWorkspace();
  const [members, setMembers] = useState<LiveLocationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastAutomaticTimezoneSync = useRef(0);
  const sharing = Boolean(profile && members.find((member) => member.userId === profile.id)?.sharingEnabled);

  const refresh = useCallback(async () => {
    if (!couple) {
      setMembers([]);
      return;
    }
    try {
      setMembers((await getLiveLocations()).members);
    } catch {
      // Location is optional; a temporary network failure should not block the app.
    }
  }, [couple?.id]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('location', refresh);

  const push = useCallback(async (loc: Location.LocationObject) => {
    const timezone = profile?.timezone_mode === 'automatic' ? tzlookup(loc.coords.latitude, loc.coords.longitude) : null;
    await sendLivePosition({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy,
      capturedAt: new Date(loc.timestamp).toISOString(),
      timezone,
    });
    if (timezone && timezone !== profile?.timezone) void refreshWorkspace().catch(() => undefined);
  }, [profile?.timezone, profile?.timezone_mode, refreshWorkspace]);

  const syncAutomaticTimezone = useCallback(async (force = false) => {
    if (!profile || profile.timezone_mode !== 'automatic') return null;
    if (!force && Date.now() - lastAutomaticTimezoneSync.current < AUTO_TIMEZONE_SYNC_MS) return profile.timezone;
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const timezone = tzlookup(loc.coords.latitude, loc.coords.longitude);
    lastAutomaticTimezoneSync.current = Date.now();
    if (timezone !== profile.timezone) {
      await updateProfile({ timezone });
      await refreshWorkspace();
    }
    return timezone;
  }, [profile, refreshWorkspace]);

  useEffect(() => {
    if (profile?.timezone_mode !== 'automatic') return;
    void syncAutomaticTimezone().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncAutomaticTimezone().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [profile?.id, profile?.timezone_mode, syncAutomaticTimezone]);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      watch.current?.remove();
      watch.current = null;
      if (!sharing) return;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) await push(current).catch(() => undefined);
      if (cancelled) return;
      watch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 25 },
        (loc) => { push(loc).catch(() => undefined); },
      );
    }
    sync().catch(() => undefined);
    return () => {
      cancelled = true;
      watch.current?.remove();
      watch.current = null;
    };
  }, [sharing, push]);

  const setSharing = useCallback(async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Location permission is needed to share your location.');

        let backgroundGranted = false;
        if (Constants.appOwnership !== 'expo') {
          const background = await Location.requestBackgroundPermissionsAsync();
          backgroundGranted = background.status === 'granted';
        }

        await setLocationSharing(true);
        await refresh();

        if (Constants.appOwnership !== 'expo' && backgroundGranted && !(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 15000,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'Togetherly location sharing',
              notificationBody: 'Your location is being shared with your partner.',
            },
          }).catch(() => undefined);
        }
      } else {
        watch.current?.remove();
        watch.current = null;
        if (Constants.appOwnership !== 'expo' && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
        }
        await setLocationSharing(false);
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const refreshAutomaticTimezone = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    lastAutomaticTimezoneSync.current = Date.now();
    return tzlookup(loc.coords.latitude, loc.coords.longitude);
  }, []);

  return <Context.Provider value={{ members, sharing, loading, refresh, setSharing, refreshAutomaticTimezone }}>{children}</Context.Provider>;
}

export function useLocationSharing() {
  const value = useContext(Context);
  if (!value) throw new Error('useLocationSharing must be inside LocationProvider');
  return value;
}
