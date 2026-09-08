const fs = require('fs');
const path = require('path');

const project = 'C:\\Users\\Liam\\Downloads\\Togetherly-v1.14-Everywhere';

function read(rel) {
  const full = path.join(project, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function write(rel, text) {
  fs.writeFileSync(path.join(project, rel), text, 'utf8');
}
function replaceOnce(rel, regex, replacement, marker) {
  let text = read(rel);
  if (marker && text.includes(marker)) {
    console.log(`Already patched ${rel}`);
    return;
  }
  const matches = [...text.matchAll(regex)];
  if (matches.length !== 1) {
    throw new Error(`Could not safely patch ${rel}. Expected 1 matching block, found ${matches.length}.`);
  }
  text = text.replace(regex, replacement);
  write(rel, text);
  console.log(`Patched ${rel}`);
}

// 1) API runtime discovery: avoid hitting GitHub on every single API request.
// Refresh at most once per minute, but allow forced refresh after a failed backend connection.
replaceOnce(
  'src/services/backend/api.ts',
  /let backendConfigPromise: Promise<void> \| null = null;/g,
  `let backendConfigPromise: Promise<void> | null = null;
let backendConfigResolvedAt = 0;
const BACKEND_CONFIG_TTL_MS = 60_000;`,
  'const BACKEND_CONFIG_TTL_MS = 60_000;'
);

replaceOnce(
  'src/services/backend/api.ts',
  /export async function initializeBackendConfig\(force = false\) \{[\s\S]*?\n\}/g,
  `export async function initializeBackendConfig(force = false) {
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
}`,
  'backendConfigResolvedAt > 0'
);

replaceOnce(
  'src/services/backend/api.ts',
  /retryAfterRefresh\?: boolean;\n\};/g,
  `retryAfterRefresh?: boolean;
  retryAfterConfig?: boolean;
};`,
  'retryAfterConfig?: boolean;'
);

replaceOnce(
  'src/services/backend/api.ts',
  /  let response: Response;\n  try \{\n    response = await fetch\(`\$\{apiUrl\}\$\{path\}`, \{[\s\S]*?\n  \} catch \{\n    if \(authenticated && method === 'GET'\) \{[\s\S]*?\n    throw new ApiClientError\(0, 'Togetherly couldn.t connect\. Check your internet connection and try again\.'\);\n  \}/g,
  `  const requestApiUrl = apiUrl;
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
  }`,
  'const requestApiUrl = apiUrl;'
);

// 2) Runtime config fetch: bound GitHub discovery so a slow raw.githubusercontent.com
// request cannot stall normal Togetherly API traffic indefinitely.
replaceOnce(
  'src/services/backend/runtimeConfig.ts',
  /const CACHE_KEY = 'togetherly\.runtime-api-url\.v1';/g,
  `const CACHE_KEY = 'togetherly.runtime-api-url.v1';
const RUNTIME_CONFIG_TIMEOUT_MS = 4_000;`,
  'const RUNTIME_CONFIG_TIMEOUT_MS = 4_000;'
);

replaceOnce(
  'src/services/backend/runtimeConfig.ts',
  /  try \{\n    const response = await fetch\(`\$\{RUNTIME_CONFIG_URL\}\?t=\$\{Date\.now\(\)\}`, \{\n      headers: \{ Accept: 'application\/json', 'Cache-Control': 'no-cache' \},\n    \}\);/g,
  `  try {
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
    }`,
  'RUNTIME_CONFIG_TIMEOUT_MS'
);

// 3) Realtime: resolve the current runtime API before opening WebSocket, and
// periodically force discovery while reconnecting so a changed trycloudflare URL recovers.
replaceOnce(
  'src/services/backend/realtime.ts',
  /import \{ backendConfig, getUsableAccessToken \} from '\.\/api';/g,
  `import { backendConfig, getUsableAccessToken, initializeBackendConfig } from './api';`,
  'initializeBackendConfig'
);

replaceOnce(
  'src/services/backend/realtime.ts',
  /  private manuallyStopped = true;/g,
  `  private manuallyStopped = true;
  private lastRuntimeRefreshAt = 0;`,
  'lastRuntimeRefreshAt'
);

replaceOnce(
  'src/services/backend/realtime.ts',
  /  private async ensureConnected\(\) \{\n    if \(!backendConfig\.isConfigured \|\| this\.socket \|\| this\.manuallyStopped \|\| this\.listeners\.size === 0\) return;\n    const accessToken = await getUsableAccessToken\(\);/g,
  `  private async ensureConnected(refreshRuntime = false) {
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
    const accessToken = await getUsableAccessToken();`,
  'private async ensureConnected(refreshRuntime = false)'
);

replaceOnce(
  'src/services/backend/realtime.ts',
  /this\.reconnectTimer = setTimeout\(\(\) => this\.ensureConnected\(\)\.catch\(\(\) => undefined\), 2000\);/g,
  `this.reconnectTimer = setTimeout(() => this.ensureConnected(true).catch(() => undefined), 2000);`,
  'this.ensureConnected(true).catch'
);

// 4) Watch bridge: do not skip Watch/widget sync merely because runtime API discovery
// has not run yet. Also ensures newly discovered tunnel URL is what gets sent to Watch.
replaceOnce(
  'src/providers/WatchBridgeProvider.tsx',
  /import \{ backendConfig \} from '@\/services\/backend\/api';/g,
  `import { backendConfig, initializeBackendConfig } from '@/services/backend/api';`,
  'backendConfig, initializeBackendConfig'
);

replaceOnce(
  'src/providers/WatchBridgeProvider.tsx',
  /  const refresh = useCallback\(async \(\) => \{\n    if \(Platform\.OS !== 'ios' \|\| !user \|\| !couple \|\| !backendConfig\.isConfigured\) return;\n    if \(syncing\.current\) return syncing\.current;/g,
  `  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios' || !user || !couple) return;
    await initializeBackendConfig().catch(() => undefined);
    if (!backendConfig.isConfigured) return;
    if (syncing.current) return syncing.current;`,
  'await initializeBackendConfig().catch'
);

// 5) Location privacy: when the user turns sharing off, immediately stop local
// foreground/background transmission before attempting the server-side revoke.
// If the revoke fails, the UI reports it, but the phone no longer keeps sending positions.
replaceOnce(
  'src/providers/LocationProvider.tsx',
  /  const setSharing = useCallback\(async \(enabled: boolean\) => \{\n    setLoading\(true\);\n    try \{\n      if \(enabled\) \{[\s\S]*?\n      await setLocationSharing\(enabled\);\n      await refresh\(\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \}, \[refresh\]\);/g,
  `  const setSharing = useCallback(async (enabled: boolean) => {
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
  }, [refresh]);`,
  'let backgroundGranted = false;'
);

// 6) Make the location screen wording accurate when background permission is unavailable.
replaceOnce(
  'src/app/features/location.tsx',
  /subtitle="Keep sharing until you turn it off\."/g,
  `subtitle="Shares with your partner; background updates depend on device permission."`,
  'background updates depend on device permission'
);

console.log('');
console.log('Batch 5 patch complete.');
console.log('Run:');
console.log('  npm run typecheck');
console.log('  npm --prefix server run typecheck');
