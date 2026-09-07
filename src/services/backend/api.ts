import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession, AuthTokens, Profile } from '@/types/database';
import { resolveRuntimeApiUrl } from './runtimeConfig';

const embeddedApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '') ?? '';
let apiUrl = embeddedApiUrl;
let backendConfigPromise: Promise<void> | null = null;
const STORAGE_KEY = 'togetherly.auth.session.v1';
const CACHE_PREFIX = 'togetherly.api.cache.v1';

export const backendConfig: { apiUrl: string; isConfigured: boolean; source: string } = {
  apiUrl,
  isConfigured: /^https?:\/\//.test(apiUrl),
  source: apiUrl ? 'embedded' : 'none',
};

export async function initializeBackendConfig(force = false) {
  if (backendConfigPromise && !force) return backendConfigPromise;
  backendConfigPromise = (async () => {
    const resolved = await resolveRuntimeApiUrl(embeddedApiUrl);
    apiUrl = resolved.apiUrl;
    backendConfig.apiUrl = resolved.apiUrl;
    backendConfig.isConfigured = /^https?:\/\//.test(resolved.apiUrl);
    backendConfig.source = resolved.source;
  })();
  try {
    await backendConfigPromise;
  } finally {
    backendConfigPromise = null;
  }
}

let session: AuthSession | null = null;
let refreshPromise: Promise<AuthSession | null> | null = null;
const sessionListeners = new Set<(session: AuthSession | null) => void>();

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  retryAfterRefresh?: boolean;
};

export class ApiClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function readStoredValue() {
  return Platform.OS === 'web' ? AsyncStorage.getItem(STORAGE_KEY) : SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeStoredValue(value: string) {
  if (Platform.OS === 'web') await AsyncStorage.setItem(STORAGE_KEY, value);
  else await SecureStore.setItemAsync(STORAGE_KEY, value);
}

async function deleteStoredValue() {
  if (Platform.OS === 'web') await AsyncStorage.removeItem(STORAGE_KEY);
  else await SecureStore.deleteItemAsync(STORAGE_KEY);
}

function sessionForStorage(next: AuthSession): AuthSession {
  return { ...next, user: { ...next.user, avatar_url: null } };
}

async function persist(next: AuthSession | null) {
  session = next;
  if (next) {
    const storedSession = Platform.OS === 'web' ? next : sessionForStorage(next);
    await writeStoredValue(JSON.stringify(storedSession));
  } else await deleteStoredValue();
  for (const listener of sessionListeners) listener(next);
}

function cacheKey(path: string) {
  return session?.user?.id ? `${CACHE_PREFIX}.${session.user.id}.${path}` : null;
}

async function readCachedResponse<T>(path: string): Promise<T | null> {
  const key = cacheKey(path);
  if (!key) return null;
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

async function cacheResponse(path: string, value: unknown) {
  const key = cacheKey(path);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Offline cache is best-effort and must never break a successful request.
  }
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await initializeBackendConfig();
  if (!backendConfig.isConfigured) throw new ApiClientError(0, 'Togetherly API is not configured.');
  const authenticated = options.authenticated !== false;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const method = options.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    if (authenticated && method === 'GET') {
      const cached = await readCachedResponse<T>(path);
      if (cached !== null) return cached;
    }
    throw new ApiClientError(0, 'Togetherly couldn’t connect. Check your internet connection and try again.');
  }

  if (response.status === 401 && authenticated && options.retryAfterRefresh !== false && session?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) return rawRequest<T>(path, { ...options, retryAfterRefresh: false });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiClientError(response.status, payload?.error ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T;
  if (authenticated && method === 'GET') await cacheResponse(path, payload);
  return payload;
}

export async function initializeStoredSession(): Promise<AuthSession | null> {
  const stored = await readStoredValue();
  if (!stored) {
    session = null;
    return null;
  }
  try {
    session = JSON.parse(stored) as AuthSession;
  } catch {
    await persist(null);
    return null;
  }
  return session;
}

export function getStoredSession() {
  return session;
}

export async function ensureStoredSession(): Promise<AuthSession | null> {
  if (session) return session;
  return initializeStoredSession();
}

export function subscribeToStoredSession(listener: (next: AuthSession | null) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export async function storeSession(next: AuthSession | null) {
  await persist(next);
}

export async function refreshSession(): Promise<AuthSession | null> {
  if (!session?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const result = await rawRequest<AuthTokens & { user: Profile }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: session?.refreshToken },
        authenticated: false,
        retryAfterRefresh: false,
      });
      const next: AuthSession = { ...result, user: result.user };
      await persist(next);
      return next;
    } catch {
      await persist(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function getUsableAccessToken(): Promise<string | null> {
  if (!session) return null;
  const expiresAt = new Date(session.accessTokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 30_000) {
    const refreshed = await refreshSession();
    return refreshed?.accessToken ?? null;
  }
  return session.accessToken;
}

export function apiRequest<T>(path: string, options?: RequestOptions) {
  return rawRequest<T>(path, options);
}
