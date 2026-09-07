import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { enablePushNotifications, disablePushNotifications, getPushStatus, subscribeToPushInteractions, syncPushRegistrationIfGranted, type PushStatus } from '@/services/pushNotifications';
import { sendTestPush } from '@/services/backend/mvpFeatures';

const initial: PushStatus = { supported: false, permission: 'undetermined', token: null, registered: false };

type Value = {
  status: PushStatus;
  isLoading: boolean;
  refresh: () => Promise<PushStatus>;
  enable: () => Promise<PushStatus>;
  disable: () => Promise<PushStatus>;
  sendTest: () => Promise<void>;
};
const Context = createContext<Value | null>(null);

export function PushNotificationsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>(initial);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getPushStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    if (!user) { setStatus(initial); return; }
    syncPushRegistrationIfGranted().then(setStatus).catch(() => refresh().catch(() => undefined));
  }, [refresh, user]);

  useEffect(() => subscribeToPushInteractions((href) => router.push(href as never)), []);

  const enable = useCallback(async () => {
    setIsLoading(true);
    try { const next = await enablePushNotifications(); setStatus(next); return next; }
    finally { setIsLoading(false); }
  }, []);
  const disable = useCallback(async () => {
    setIsLoading(true);
    try { const next = await disablePushNotifications(); setStatus(next); return next; }
    finally { setIsLoading(false); }
  }, []);
  const sendTest = useCallback(async () => { await sendTestPush(); }, []);

  const value = useMemo(() => ({ status, isLoading, refresh, enable, disable, sendTest }), [disable, enable, isLoading, refresh, sendTest, status]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePushNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('usePushNotifications must be used inside PushNotificationsProvider.');
  return value;
}
