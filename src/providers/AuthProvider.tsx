import { AppState } from 'react-native';
import { retryOfflineChanges } from '@/services/backend/api';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { AuthSession, Profile } from '@/types/database';
import { restoreAuthSession, signInWithEmail, signOut as signOutRequest, signUpWithEmail } from '@/services/backend/auth';
import { backendConfig, initializeBackendConfig, subscribeToStoredSession } from '@/services/backend/api';
import { realtimeClient } from '@/services/backend/realtime';

type AuthContextValue = {
  session: AuthSession | null;
  user: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; timezone: string }) => Promise<{ needsEmailVerification: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(backendConfig.isConfigured);

  useEffect(() => {
    const unsubscribe = subscribeToStoredSession((next) => setSession(next));
    let mounted = true;

    initializeBackendConfig()
      .then(async () => {
        if (!mounted) return;
        setIsConfigured(backendConfig.isConfigured);
        if (!backendConfig.isConfigured) return null;
        return restoreAuthSession();
      })
      .then((next) => {
        if (mounted && next !== null && next !== undefined) setSession(next);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let delay = 5000;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    const retry = async () => {
      if (running || stopped) return;
      running = true;
      if (AppState.currentState === 'active' || AppState.currentState == null) {
        try { await retryOfflineChanges(); delay = 5000; } catch { delay = Math.min(delay * 2, 60000); }
      }
      running = false;
      if (!stopped) timer = setTimeout(retry, delay);
    };
    timer = setTimeout(retry, delay);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') { clearTimeout(timer); void retry(); }
    });
    return () => { stopped = true; clearTimeout(timer); foreground.remove(); };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await signInWithEmail(email, password);
    setSession(data);
    realtimeClient.restart();
  }, []);

  const signUp = useCallback(async (input: { email: string; password: string; timezone: string }) => {
    const data = await signUpWithEmail(input);
    setSession(data);
    realtimeClient.restart();
    return { needsEmailVerification: false };
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
    setSession(null);
    realtimeClient.restart();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    isConfigured,
    signIn,
    signUp,
    signOut,
  }), [isConfigured, isLoading, session, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
