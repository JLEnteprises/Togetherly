const fs = require('fs');
const path = require('path');

const project = 'C:\\Users\\Liam\\Downloads\\Togetherly-v1.14-Everywhere';

function full(rel) { return path.join(project, rel); }
function read(rel) {
  if (!fs.existsSync(full(rel))) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full(rel), 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  fs.writeFileSync(full(rel), text.replace(/\n/g, '\r\n'), 'utf8');
}

// ---- API.TS: verify/repair Batch 5 pieces already partially applied ----
{
  let text = read('src/services/backend/api.ts');

  if (!text.includes('const BACKEND_CONFIG_TTL_MS = 60_000;')) {
    text = text.replace(
      'let backendConfigPromise: Promise<void> | null = null;',
      'let backendConfigPromise: Promise<void> | null = null;\nlet backendConfigResolvedAt = 0;\nconst BACKEND_CONFIG_TTL_MS = 60_000;'
    );
  }

  if (!text.includes('backendConfigResolvedAt > 0')) {
    const old = `export async function initializeBackendConfig(force = false) {
  if (backendConfigPromise && !force) return backendConfigPromise;
  backendConfigPromise = (async () => {
    const resolved = await resolveRuntimeApiUrl(embeddedApiUrl);
    apiUrl = resolved.apiUrl;
    backendConfig.apiUrl = resolved.apiUrl;
    backendConfig.isConfigured = /^https?:\\/\\//.test(resolved.apiUrl);
    backendConfig.source = resolved.source;
  })();
  try {
    await backendConfigPromise;
  } finally {
    backendConfigPromise = null;
  }
}`;
    const next = `export async function initializeBackendConfig(force = false) {
  if (!force && backendConfigResolvedAt > 0 && Date.now() - backendConfigResolvedAt < BACKEND_CONFIG_TTL_MS) return;
  if (backendConfigPromise) return backendConfigPromise;
  backendConfigPromise = (async () => {
    const resolved = await resolveRuntimeApiUrl(embeddedApiUrl);
    apiUrl = resolved.apiUrl;
    backendConfig.apiUrl = resolved.apiUrl;
    backendConfig.isConfigured = /^https?:\\/\\//.test(resolved.apiUrl);
    backendConfig.source = resolved.source;
    backendConfigResolvedAt = Date.now();
  })();
  try {
    await backendConfigPromise;
  } finally {
    backendConfigPromise = null;
  }
}`;
    if (!text.includes(old)) throw new Error('api.ts initializeBackendConfig block not found.');
    text = text.replace(old, next);
  }

  if (!text.includes('retryAfterConfig?: boolean;')) {
    const old = '  retryAfterRefresh?: boolean;\n};';
    if (!text.includes(old)) throw new Error('api.ts RequestOptions block not found.');
    text = text.replace(old, '  retryAfterRefresh?: boolean;\n  retryAfterConfig?: boolean;\n};');
  }

  if (!text.includes('const requestApiUrl = apiUrl;')) {
    const old = `  let response: Response;
  try {
    response = await fetch(\`\${apiUrl}\${path}\`, {
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
  }`;
    const next = `  const requestApiUrl = apiUrl;
  let response: Response;
  try {
    response = await fetch(\`\${apiUrl}\${path}\`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    if (options.retryAfterConfig !== false) {
      await initializeBackendConfig(true).catch(() => undefined);
      if (backendConfig.isConfigured && apiUrl !== requestApiUrl) {
        return rawRequest<T>(path, { ...options, retryAfterConfig: false });
      }
    }
    if (authenticated && method === 'GET') {
      const cached = await readCachedResponse<T>(path);
      if (cached !== null) return cached;
    }
    throw new ApiClientError(0, 'Togetherly could not connect. Check your internet connection and try again.');
  }`;
    if (!text.includes(old)) throw new Error('api.ts request failure block not found.');
    text = text.replace(old, next);
  }

  write('src/services/backend/api.ts', text);
  console.log('Verified src/services/backend/api.ts');
}

// ---- RUNTIME CONFIG: v1 added the timeout constant but skipped the actual timeout code ----
{
  let text = read('src/services/backend/runtimeConfig.ts');

  if (!text.includes('const RUNTIME_CONFIG_TIMEOUT_MS = 4_000;')) {
    text = text.replace(
      "const CACHE_KEY = 'togetherly.runtime-api-url.v1';",
      "const CACHE_KEY = 'togetherly.runtime-api-url.v1';\nconst RUNTIME_CONFIG_TIMEOUT_MS = 4_000;"
    );
  }

  if (!text.includes('const controller = new AbortController();')) {
    const old = `  try {
    const response = await fetch(\`\${RUNTIME_CONFIG_URL}?t=\${Date.now()}\`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (response.ok) {`;
    const next = `  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUNTIME_CONFIG_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(\`\${RUNTIME_CONFIG_URL}?t=\${Date.now()}\`, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) {`;
    if (!text.includes(old)) throw new Error('runtimeConfig.ts fetch block not found.');
    text = text.replace(old, next);
  }

  write('src/services/backend/runtimeConfig.ts', text);
  console.log('Verified src/services/backend/runtimeConfig.ts');
}

// ---- REALTIME: handle the exact partial state produced by Batch 5 v1 ----
{
  let text = read('src/services/backend/realtime.ts');

  if (!text.includes('initializeBackendConfig')) {
    const old = "import { backendConfig, getUsableAccessToken } from './api';";
    if (!text.includes(old)) throw new Error('realtime.ts api import not found.');
    text = text.replace(old, "import { backendConfig, getUsableAccessToken, initializeBackendConfig } from './api';");
  }

  if (!text.includes('private lastRuntimeRefreshAt = 0;')) {
    const old = '  private manuallyStopped = true;';
    if (!text.includes(old)) throw new Error('realtime.ts manuallyStopped field not found.');
    text = text.replace(old, '  private manuallyStopped = true;\n  private lastRuntimeRefreshAt = 0;');
  }

  if (!text.includes('private async ensureConnected(refreshRuntime = false)')) {
    const old = `  private async ensureConnected() {
    if (!backendConfig.isConfigured || this.socket || this.manuallyStopped || this.listeners.size === 0) return;
    const accessToken = await getUsableAccessToken();
    if (!accessToken) return;
    const wsUrl = backendConfig.apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const socket = new WebSocket(\`\${wsUrl}/realtime\`);
    this.socket = socket;`;
    const next = `  private async ensureConnected(refreshRuntime = false) {
    if (this.socket || this.manuallyStopped || this.listeners.size === 0) return;
    if (refreshRuntime && Date.now() - this.lastRuntimeRefreshAt >= 15_000) {
      await initializeBackendConfig(true).catch(() => undefined);
      this.lastRuntimeRefreshAt = Date.now();
    } else {
      await initializeBackendConfig().catch(() => undefined);
    }
    if (!backendConfig.isConfigured) {
      this.reconnectTimer = setTimeout(() => this.ensureConnected(true).catch(() => undefined), 5_000);
      return;
    }
    const accessToken = await getUsableAccessToken();
    if (!accessToken) return;
    const wsUrl = backendConfig.apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const socket = new WebSocket(\`\${wsUrl}/realtime\`);
    this.socket = socket;`;
    if (!text.includes(old)) throw new Error('realtime.ts ensureConnected block not found.');
    text = text.replace(old, next);
  }

  if (!text.includes('this.ensureConnected(true).catch(() => undefined), 2000')) {
    const old = '        this.reconnectTimer = setTimeout(() => this.ensureConnected().catch(() => undefined), 2000);';
    const next = '        this.reconnectTimer = setTimeout(() => this.ensureConnected(true).catch(() => undefined), 2000);';
    if (!text.includes(old)) throw new Error('realtime.ts reconnect timer block not found.');
    text = text.replace(old, next);
  }

  write('src/services/backend/realtime.ts', text);
  console.log('Verified src/services/backend/realtime.ts');
}

// ---- WATCH BRIDGE ----
{
  let text = read('src/providers/WatchBridgeProvider.tsx');

  if (!text.includes('backendConfig, initializeBackendConfig')) {
    const old = "import { backendConfig } from '@/services/backend/api';";
    const next = "import { backendConfig, initializeBackendConfig } from '@/services/backend/api';";
    if (!text.includes(old)) throw new Error('WatchBridgeProvider.tsx api import not found.');
    text = text.replace(old, next);
  }

  if (!text.includes('await initializeBackendConfig().catch(() => undefined);')) {
    const old = `  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios' || !user || !couple || !backendConfig.isConfigured) return;
    if (syncing.current) return syncing.current;`;
    const next = `  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios' || !user || !couple) return;
    await initializeBackendConfig().catch(() => undefined);
    if (!backendConfig.isConfigured) return;
    if (syncing.current) return syncing.current;`;
    if (!text.includes(old)) throw new Error('WatchBridgeProvider.tsx refresh block not found.');
    text = text.replace(old, next);
  }

  write('src/providers/WatchBridgeProvider.tsx', text);
  console.log('Verified src/providers/WatchBridgeProvider.tsx');
}

// ---- LOCATION PROVIDER ----
{
  let text = read('src/providers/LocationProvider.tsx');

  if (!text.includes('let backgroundGranted = false;')) {
    const old = `  const setSharing = useCallback(async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Location permission is needed to share your location.');
        if (Constants.appOwnership !== 'expo') {
          const background = await Location.requestBackgroundPermissionsAsync();
          if (background.status === 'granted' && !(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
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
            });
          }
        }
      } else if (Constants.appOwnership !== 'expo' && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
      await setLocationSharing(enabled);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);`;

    const next = `  const setSharing = useCallback(async (enabled: boolean) => {
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
  }, [refresh]);`;

    if (!text.includes(old)) throw new Error('LocationProvider.tsx setSharing block not found.');
    text = text.replace(old, next);
  }

  write('src/providers/LocationProvider.tsx', text);
  console.log('Verified src/providers/LocationProvider.tsx');
}

// ---- LOCATION SCREEN COPY ----
{
  let text = read('src/app/features/location.tsx');

  if (!text.includes('background updates depend on device permission')) {
    const old = '            subtitle="Keep sharing until you turn it off."';
    const next = '            subtitle="Shares with your partner; background updates depend on device permission."';
    if (!text.includes(old)) throw new Error('location.tsx sharing subtitle not found.');
    text = text.replace(old, next);
  }

  write('src/app/features/location.tsx', text);
  console.log('Verified src/app/features/location.tsx');
}

console.log('');
console.log('Batch 5 v2 repair complete.');
console.log('Now run:');
console.log('  npm run typecheck');
console.log('  npm --prefix server run typecheck');
