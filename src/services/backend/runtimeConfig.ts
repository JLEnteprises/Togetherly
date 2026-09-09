import AsyncStorage from '@react-native-async-storage/async-storage';

const RUNTIME_CONFIG_URL = 'https://raw.githubusercontent.com/JLEnteprises/Togetherly/main/runtime-config.json';
const CACHE_KEY = 'togetherly.runtime-api-url.v2';
const RUNTIME_CONFIG_TIMEOUT_MS = 4_000;

export type RuntimeBackendConfig = {
  apiUrl: string;
  source: 'github' | 'cache' | 'embedded' | 'none';
};

function normalizeApiUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\/$/, '');
  return /^https?:\/\//i.test(normalized) ? normalized : '';
}

export async function resolveRuntimeApiUrl(embeddedUrl: string): Promise<RuntimeBackendConfig> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUNTIME_CONFIG_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${RUNTIME_CONFIG_URL}?t=${Date.now()}`, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) {
      const raw = await response.text();
      const payload = JSON.parse(raw.replace(/^\uFEFF/, '')) as { apiUrl?: unknown };
      const apiUrl = normalizeApiUrl(payload.apiUrl);
      if (apiUrl) {
        await AsyncStorage.setItem(CACHE_KEY, apiUrl).catch(() => undefined);
        return { apiUrl, source: 'github' };
      }
    }
  } catch {
    // Runtime discovery is best-effort. Fall through to the cached/embedded URL.
  }

  const cached = normalizeApiUrl(await AsyncStorage.getItem(CACHE_KEY).catch(() => null));
  if (cached) return { apiUrl: cached, source: 'cache' };

  const embedded = normalizeApiUrl(embeddedUrl);
  if (embedded) return { apiUrl: embedded, source: 'embedded' };

  return { apiUrl: '', source: 'none' };
}
