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
function replaceExactlyOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Found more than one ${label}; refusing unsafe patch.`);
  return text.replace(oldText, newText);
}

// 0) Compatibility cleanup for the known Batch 4 trip-detail duplicate catch/finally.
// Safe to skip when the separate repair has already been run.
{
  const rel = 'src/app/features/trip-detail.tsx';
  let text = read(rel);
  const duplicate = /(\} finally \{ setBusy\(false\); \} \})\s*catch \(error\) \{ Alert\.alert\('Couldn[^']*create countdown', messageFrom\(error\)\); \} finally \{ setBusy\(false\); \} \}/;
  if (duplicate.test(text)) {
    text = text.replace(duplicate, '$1');
    write(rel, text);
    console.log('Repaired known Trip Detail duplicate catch/finally.');
  } else {
    console.log('Trip Detail compatibility cleanup not needed.');
  }
}

// 1) Privacy hardening: authenticated GET caches are user-scoped, but they were
// left in AsyncStorage after logout/session invalidation. Clear that user's API
// cache whenever the stored session is removed.
{
  const rel = 'src/services/backend/api.ts';
  let text = read(rel);

  if (!text.includes('async function clearCachedResponsesForUser')) {
    const marker = `function sessionForStorage(next: AuthSession): AuthSession {
  return { ...next, user: { ...next.user, avatar_url: null } };
}

`;
    const addition = `function sessionForStorage(next: AuthSession): AuthSession {
  return { ...next, user: { ...next.user, avatar_url: null } };
}

async function clearCachedResponsesForUser(userId: string) {
  try {
    const prefix = \`\${CACHE_PREFIX}.\${userId}.\`;
    const keys = await AsyncStorage.getAllKeys();
    const matches = keys.filter((key) => key.startsWith(prefix));
    if (matches.length) await AsyncStorage.multiRemove(matches);
  } catch {
    // Cache cleanup is best-effort and must not prevent sign-out.
  }
}

`;
    text = replaceExactlyOnce(text, marker, addition, 'api.ts sessionForStorage block');
  }

  if (!text.includes('const previousUserId = session?.user?.id ?? null;')) {
    const old = `async function persist(next: AuthSession | null) {
  session = next;
  if (next) {
    const storedSession = Platform.OS === 'web' ? next : sessionForStorage(next);
    await writeStoredValue(JSON.stringify(storedSession));
  } else await deleteStoredValue();
  for (const listener of sessionListeners) listener(next);
}`;
    const next = `async function persist(next: AuthSession | null) {
  const previousUserId = session?.user?.id ?? null;
  session = next;
  if (next) {
    const storedSession = Platform.OS === 'web' ? next : sessionForStorage(next);
    await writeStoredValue(JSON.stringify(storedSession));
  } else {
    await deleteStoredValue();
    if (previousUserId) await clearCachedResponsesForUser(previousUserId);
  }
  for (const listener of sessionListeners) listener(next);
}`;
    text = replaceExactlyOnce(text, old, next, 'api.ts persist block');
  }

  write(rel, text);
  console.log('Verified API cache cleanup on session end.');
}

// 2) Push registration correctness on a shared phone / account switch.
// The local registration type already had userId, but it was never populated or checked.
{
  const rel = 'src/services/pushNotifications.native.ts';
  let text = read(rel);

  if (!text.includes("getStoredSession } from '@/services/backend/api'")) {
    const old = `import { deactivatePushToken, registerPushDevice } from '@/services/backend/mvpFeatures';`;
    const next = `import { deactivatePushToken, registerPushDevice } from '@/services/backend/mvpFeatures';
import { getStoredSession } from '@/services/backend/api';`;
    text = replaceExactlyOnce(text, old, next, 'push API import');
  }

  if (!text.includes('const currentUserId = getStoredSession()?.user?.id ?? null;')) {
    const old = `  const permission = normalizePermission((await Notifications.getPermissionsAsync()).status);
  const stored = await readStored();
  return { supported: true, permission, token: stored?.token ?? null, registered: Boolean(stored?.token) };`;
    const next = `  const permission = normalizePermission((await Notifications.getPermissionsAsync()).status);
  const stored = await readStored();
  const currentUserId = getStoredSession()?.user?.id ?? null;
  const belongsToCurrentUser = Boolean(stored?.token && currentUserId && stored.userId === currentUserId);
  return { supported: true, permission, token: belongsToCurrentUser ? stored!.token : null, registered: belongsToCurrentUser };`;
    text = replaceExactlyOnce(text, old, next, 'getPushStatus registration block');
  }

  if (!text.includes("if (!userId) throw new Error('Sign in before registering push notifications.');")) {
    const old = `  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = Device.deviceName ?? Device.modelName ?? (platform === 'ios' ? 'iPhone' : 'Android device');
  await registerPushDevice({ token, platform, deviceName });
  await writeStored({ token, platform });
  return token;`;
    const next = `  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceName = Device.deviceName ?? Device.modelName ?? (platform === 'ios' ? 'iPhone' : 'Android device');
  const userId = getStoredSession()?.user?.id ?? null;
  if (!userId) throw new Error('Sign in before registering push notifications.');
  await registerPushDevice({ token, platform, deviceName });
  await writeStored({ token, platform, userId });
  return token;`;
    text = replaceExactlyOnce(text, old, next, 'registerCurrentToken storage block');
  }

  if (!text.includes('const belongsToCurrentUser = Boolean(stored?.token && currentUserId && stored.userId === currentUserId);') ||
      (text.match(/const belongsToCurrentUser = Boolean/g) || []).length < 2) {
    const old = `  } catch (error) {
    const stored = await readStored();
    return { supported: true, permission: 'granted', token: stored?.token ?? null, registered: Boolean(stored?.token), reason: error instanceof Error ? error.message : 'Could not register this device.' };
  }`;
    const next = `  } catch (error) {
    const stored = await readStored();
    const currentUserId = getStoredSession()?.user?.id ?? null;
    const belongsToCurrentUser = Boolean(stored?.token && currentUserId && stored.userId === currentUserId);
    return { supported: true, permission: 'granted', token: belongsToCurrentUser ? stored!.token : null, registered: belongsToCurrentUser, reason: error instanceof Error ? error.message : 'Could not register this device.' };
  }`;
    text = replaceExactlyOnce(text, old, next, 'syncPushRegistrationIfGranted catch block');
  }

  write(rel, text);
  console.log('Verified per-account local push registration state.');
}

// 3) Build/release hardening.
// Dynamic runtime discovery means the unsigned IPA no longer needs a real tunnel URL
// embedded at build time. Use example.invalid as a harmless fallback when blank.
// Also typecheck backend + pure logic smoke tests in CI.
{
  const rel = '.github/workflows/build-unsigned-ipa.yml';
  let text = read(rel);

  if (!text.includes("Using dynamic runtime API discovery; embedding https://example.invalid as fallback.")) {
    const old = `          if [[ -z "$API_URL" ]]; then
            echo '::error::No API URL supplied. Enter api_url when running the workflow or create repository variable TOGETHERLY_API_URL.'
            exit 1
          fi
          if [[ ! "$API_URL" =~ ^https?:// ]]; then`;
    const next = `          if [[ -z "$API_URL" ]]; then
            API_URL="https://example.invalid"
            echo '::notice::Using dynamic runtime API discovery; embedding https://example.invalid as fallback.'
          fi
          if [[ ! "$API_URL" =~ ^https?:// ]]; then`;
    text = replaceExactlyOnce(text, old, next, 'workflow API URL requirement');
  }

  if (!text.includes('- name: Server typecheck')) {
    const old = `      - name: Client typecheck
        run: npm run typecheck

      - name: Install CocoaPods 1.16.2`;
    const next = `      - name: Client typecheck
        run: npm run typecheck

      - name: Install backend dependencies
        run: npm --prefix server ci --no-audit --no-fund

      - name: Server typecheck
        run: npm --prefix server run typecheck

      - name: Pure logic smoke tests
        run: npm --prefix server run logic

      - name: Install CocoaPods 1.16.2`;
    text = replaceExactlyOnce(text, old, next, 'workflow client typecheck block');
  }

  write(rel, text);
  console.log('Verified GitHub Actions release checks.');
}

console.log('');
console.log('Final combined batches applied.');
console.log('Run FINAL_VERIFY.cmd next.');
