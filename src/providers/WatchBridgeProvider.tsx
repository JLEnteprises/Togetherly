import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { backendConfig } from '@/services/backend/api';
import { acknowledgeMood, createMood, createRelationshipPing, createWatchSession, getWatchStateForPhone } from '@/services/backend/mvpFeatures';
import { realtimeClient } from '@/services/backend/realtime';
import { clearWatchContext, getWatchBridgeStatus, subscribeWatchActions, subscribeWatchStatus, syncWatchContext, type WatchBridgeStatus } from '@/services/watchBridge';
import type { MoodValue, NeedValue, WatchSession, WatchState } from '@/types/database';

const IOS_BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.example.togetherly';
const APP_GROUP = `group.${IOS_BUNDLE_ID}.shared`;
const SESSION_KEY = 'togetherly.watch.session.v1';
const emptyStatus: WatchBridgeStatus = { supported: Platform.OS === 'ios', paired: false, watchAppInstalled: false, reachable: false };
const moods = new Set<MoodValue>(['amazing','good','okay','low','frustrated','overwhelmed','tired','stressed']);
const needs = new Set<NeedValue>(['affection','reassurance','advice','listen','distraction','space','call','nothing']);

type Value = { status: WatchBridgeStatus; state: WatchState | null; isSyncing: boolean; refresh: () => Promise<void> };
const Context = createContext<Value | null>(null);

async function readWatchSession(): Promise<WatchSession | null> {
  if (Platform.OS !== 'ios') return null;
  try { const raw = await SecureStore.getItemAsync(SESSION_KEY); return raw ? JSON.parse(raw) as WatchSession : null; }
  catch { return null; }
}
async function storeWatchSession(session: WatchSession | null) {
  if (Platform.OS !== 'ios') return;
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
async function usableWatchSession() {
  const current = await readWatchSession();
  if (current && new Date(current.expiresAt).getTime() > Date.now() + 7 * 86_400_000) return current;
  const next = await createWatchSession('Apple Watch & widgets');
  await storeWatchSession(next);
  return next;
}

export function WatchBridgeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { couple } = useWorkspace();
  const [status, setStatus] = useState<WatchBridgeStatus>(emptyStatus);
  const [state, setState] = useState<WatchState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncing = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios' || !user || !couple || !backendConfig.isConfigured) return;
    if (syncing.current) return syncing.current;
    const work = (async () => {
      setIsSyncing(true);
      try {
        const [bridgeStatus, watchState, session] = await Promise.all([getWatchBridgeStatus(), getWatchStateForPhone(), usableWatchSession()]);
        setStatus(bridgeStatus);
        setState(watchState);
        await syncWatchContext(JSON.stringify({
          version: 1,
          apiUrl: backendConfig.apiUrl,
          watchToken: session.token,
          watchTokenExpiresAt: session.expiresAt,
          appGroup: APP_GROUP,
          state: watchState,
          syncedAt: new Date().toISOString(),
        }), APP_GROUP);
      } finally { setIsSyncing(false); }
    })();
    syncing.current = work;
    try { await work; } finally { syncing.current = null; }
  }, [couple, user]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!user) {
      setState(null); setStatus(emptyStatus);
      storeWatchSession(null).catch(() => undefined);
      clearWatchContext(APP_GROUP).catch(() => undefined);
      return;
    }
    refresh().catch(() => undefined);
    const timer = setInterval(() => refresh().catch(() => undefined), 15 * 60_000);
    const unsubscribeRealtime = realtimeClient.subscribe((event) => {
      if (event.type === 'feature.updated' || event.type === 'workspace.updated' || event.type === 'shared_item.updated') refresh().catch(() => undefined);
    });
    const unsubscribeStatus = subscribeWatchStatus(setStatus);
    return () => { clearInterval(timer); unsubscribeRealtime(); unsubscribeStatus(); };
  }, [refresh, user]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !user) return;
    return subscribeWatchActions((action) => {
      (async () => {
        if (action.type === 'ping' && (action.kind === 'love' || action.kind === 'thinking_of_you')) {
          await createRelationshipPing(action.kind);
        } else if (action.type === 'check_in' && moods.has(action.mood as MoodValue) && needs.has(action.need as NeedValue)) {
          await createMood({ mood: action.mood as MoodValue, need: action.need as NeedValue, visibility: 'shared' });
        } else if (action.type === 'acknowledge' && typeof action.moodId === 'string') {
          await acknowledgeMood(action.moodId);
        }
        await refresh();
      })().catch(() => undefined);
    });
  }, [refresh, user]);

  const value = useMemo(() => ({ status, state, isSyncing, refresh }), [isSyncing, refresh, state, status]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWatchBridge() {
  const value = useContext(Context);
  if (!value) throw new Error('useWatchBridge must be used inside WatchBridgeProvider.');
  return value;
}
