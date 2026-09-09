const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD7 Live Partner Presence FAILED: ${message}`);
  process.exit(1);
}

function filePath(rel) {
  return path.join(root, ...rel.split('/'));
}

function read(rel) {
  const full = filePath(rel);
  if (!fs.existsSync(full)) fail(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
}

function write(rel, text) {
  const full = filePath(rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) {
    console.log(`Already good: ${label}`);
    return text;
  }
  const first = text.indexOf(oldText);
  if (first < 0) fail(`Could not find expected source for: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

// --- Server realtime presence -------------------------------------------------

{
  const rel = 'server/src/realtime/hub.ts';
  let source = read(rel);

  source = replaceOnce(
    source,
    `type ClientState = {
  userId: string | null;
  coupleId: string | null;
};`,
    `type ClientState = {
  userId: string | null;
  coupleId: string | null;
  scope: string | null;
};`,
    'server client scope state',
  );

  source = replaceOnce(
    source,
    `      this.states.set(ws, { userId: null, coupleId: null });`,
    `      this.states.set(ws, { userId: null, coupleId: null, scope: null });`,
    'server initial scope',
  );

  source = replaceOnce(
    source,
    `        const typed = message as { type: string; accessToken?: string };
        if (typed.type !== 'auth' || !typed.accessToken) return;

        try {
          const token = verifyAccessToken(typed.accessToken);
          const userId = token.sub;
          const account = await pool.query('SELECT auth_version FROM users WHERE id = $1', [userId]);
          if (!account.rows[0] || Number(account.rows[0].auth_version) !== token.v) throw new Error('Revoked session');
          const membership = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
          const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
          this.states.set(ws, { userId, coupleId });
          clearTimeout(timeout);
          if (expiryTimeout) clearTimeout(expiryTimeout);
          const expiresInMs = Math.max(250, token.exp * 1000 - Date.now());
          expiryTimeout = setTimeout(() => ws.close(4401, 'Session expired'), expiresInMs);
          ws.send(JSON.stringify({ type: 'ready', coupleId }));
        } catch {
          clearTimeout(timeout);
          ws.close(4401, 'Invalid session');
        }`,
    `        const typed = message as { type: string; accessToken?: string; scope?: unknown };

        if (typed.type === 'auth' && typed.accessToken) {
          try {
            const token = verifyAccessToken(typed.accessToken);
            const userId = token.sub;
            const account = await pool.query('SELECT auth_version FROM users WHERE id = $1', [userId]);
            if (!account.rows[0] || Number(account.rows[0].auth_version) !== token.v) throw new Error('Revoked session');
            const membership = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
            const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
            this.states.set(ws, { userId, coupleId, scope: null });
            clearTimeout(timeout);
            if (expiryTimeout) clearTimeout(expiryTimeout);
            const expiresInMs = Math.max(250, token.exp * 1000 - Date.now());
            expiryTimeout = setTimeout(() => ws.close(4401, 'Session expired'), expiresInMs);
            ws.send(JSON.stringify({ type: 'ready', coupleId }));
            if (coupleId) this.broadcastPresence(coupleId);
          } catch {
            clearTimeout(timeout);
            ws.close(4401, 'Invalid session');
          }
          return;
        }

        if (typed.type === 'presence') {
          const state = this.states.get(ws);
          if (!state?.userId || !state.coupleId) return;
          const scope = typeof typed.scope === 'string' && typed.scope.trim()
            ? typed.scope.trim().slice(0, 100)
            : null;
          this.states.set(ws, { ...state, scope });
          this.broadcastPresence(state.coupleId);
        }`,
    'server auth and presence messages',
  );

  source = replaceOnce(
    source,
    `      ws.on('close', clearTimers);
      ws.on('error', clearTimers);`,
    `      ws.on('close', () => {
        const state = this.states.get(ws);
        clearTimers();
        if (state?.coupleId) this.broadcastPresence(state.coupleId);
      });
      ws.on('error', clearTimers);`,
    'server presence cleanup',
  );

  source = replaceOnce(
    source,
    `  broadcastCouple(coupleId: string, event: RealtimeEvent) {`,
    `  private broadcastPresence(coupleId: string) {
    const byUser = new Map<string, string | null>();
    for (const client of this.wss.clients) {
      const state = this.states.get(client);
      if (client.readyState !== WebSocket.OPEN || state?.coupleId !== coupleId || !state.userId) continue;
      const current = byUser.get(state.userId);
      if (!byUser.has(state.userId) || (!current && state.scope)) byUser.set(state.userId, state.scope);
    }
    this.broadcastCouple(coupleId, {
      type: 'presence.snapshot',
      users: [...byUser.entries()].map(([userId, scope]) => ({ userId, scope })),
    });
  }

  broadcastCouple(coupleId: string, event: RealtimeEvent) {`,
    'server presence snapshot broadcaster',
  );

  write(rel, source);
}

// --- Client realtime presence -------------------------------------------------

{
  const rel = 'src/services/backend/realtime.ts';
  let source = read(rel);

  source = replaceOnce(
    source,
    `  | { type: 'feature.updated'; resource: RealtimeResource; action: string; id?: string }
  | { type: 'error'; message: string };`,
    `  | { type: 'feature.updated'; resource: RealtimeResource; action: string; id?: string }
  | { type: 'presence.snapshot'; users: Array<{ userId: string; scope: string | null }> }
  | { type: 'error'; message: string };`,
    'client presence event type',
  );

  source = replaceOnce(
    source,
    `  private manuallyStopped = true;
  private lastRuntimeRefreshAt = 0;`,
    `  private manuallyStopped = true;
  private lastRuntimeRefreshAt = 0;
  private ready = false;
  private readonly presenceClaims = new Map<symbol, string>();
  private presenceScope: string | null = null;`,
    'client presence state',
  );

  source = replaceOnce(
    source,
    `  restart() {
    if (this.listeners.size === 0) return;
    this.manuallyStopped = false;
    this.socket?.close();
    this.socket = null;
    this.ensureConnected().catch(() => undefined);
  }`,
    `  restart() {
    if (this.listeners.size === 0) return;
    this.manuallyStopped = false;
    this.ready = false;
    this.socket?.close();
    this.socket = null;
    this.ensureConnected().catch(() => undefined);
  }

  claimPresence(scope: string) {
    const token = Symbol(scope);
    this.presenceClaims.set(token, scope.slice(0, 100));
    this.syncPresence();
    return () => {
      this.presenceClaims.delete(token);
      this.syncPresence();
    };
  }

  private syncPresence() {
    const scopes = [...this.presenceClaims.values()];
    this.presenceScope = scopes.length ? scopes[scopes.length - 1] ?? null : null;
    if (this.ready && this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify({ type: 'presence', scope: this.presenceScope }));
    }
  }`,
    'client presence claims',
  );

  source = replaceOnce(
    source,
    `  private stop() {
    this.manuallyStopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }`,
    `  private stop() {
    this.manuallyStopped = true;
    this.ready = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }`,
    'client stop readiness',
  );

  source = replaceOnce(
    source,
    `    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', accessToken }));
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeEvent;
        for (const listener of this.listeners) listener(event);
      } catch {
        // Malformed realtime messages are ignored instead of disrupting the app.
      }
    };`,
    `    socket.onopen = () => {
      this.ready = false;
      socket.send(JSON.stringify({ type: 'auth', accessToken }));
    };
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeEvent;
        if (event.type === 'ready') {
          this.ready = true;
          this.syncPresence();
        }
        for (const listener of this.listeners) listener(event);
      } catch {
        // Malformed realtime messages are ignored instead of disrupting the app.
      }
    };`,
    'client ready presence sync',
  );

  source = replaceOnce(
    source,
    `    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      if (!this.manuallyStopped && this.listeners.size > 0) {`,
    `    socket.onclose = () => {
      this.ready = false;
      if (this.socket === socket) this.socket = null;
      if (!this.manuallyStopped && this.listeners.size > 0) {`,
    'client close readiness',
  );

  write(rel, source);
}

// --- Hook + UI ---------------------------------------------------------------

write('src/hooks/usePartnerPresence.ts', `import { useEffect, useState } from 'react';
import { realtimeClient } from '@/services/backend/realtime';
import { useWorkspace } from '@/providers/WorkspaceProvider';

export function usePartnerPresence(scope: string) {
  const { partnerProfile } = useWorkspace();
  const [partnerScope, setPartnerScope] = useState<string | null>(null);

  useEffect(() => {
    const releasePresence = realtimeClient.claimPresence(scope);
    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== 'presence.snapshot') return;
      const partner = partnerProfile ? event.users.find((user) => user.userId === partnerProfile.id) : null;
      setPartnerScope(partner?.scope ?? null);
    });
    return () => {
      releasePresence();
      unsubscribe();
    };
  }, [partnerProfile, scope]);

  return {
    hasPartner: Boolean(partnerProfile),
    partnerName: partnerProfile?.display_name || 'Your partner',
    isHere: Boolean(partnerProfile && partnerScope === scope),
  };
}
`);

write('src/components/common/PartnerPresencePill.tsx', `import { View } from 'react-native';
import { AppText } from './AppText';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useAppTheme } from '@/theme/useAppTheme';

export function PartnerPresencePill({ scope }: { scope: string }) {
  const theme = useAppTheme();
  const { hasPartner, partnerName, isHere } = usePartnerPresence(scope);
  if (!hasPartner) return null;

  return (
    <View style={{
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: isHere ? theme.colors.accent : theme.colors.border,
      backgroundColor: isHere ? theme.colors.accentSoft : theme.colors.elevatedBackground,
    }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isHere ? theme.colors.accentStrong : theme.colors.textMuted }} />
      <AppText variant="bodySmall" tone={isHere ? 'accent' : 'muted'}>
        {isHere ? \`\${partnerName} is here ♥\` : \`Waiting for \${partnerName}…\`}
      </AppText>
    </View>
  );
}
`);

// --- Screen integrations ------------------------------------------------------

function addPresenceImportAndPill(rel, scopeExpression, headerMatch, label) {
  let source = read(rel);

  if (!source.includes("import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';")) {
    source = replaceOnce(
      source,
      "import { BackHeader } from '@/components/common/BackHeader';",
      "import { BackHeader } from '@/components/common/BackHeader';\nimport { PartnerPresencePill } from '@/components/common/PartnerPresencePill';",
      `${label} presence import`,
    );
  }

  if (!source.includes(`<PartnerPresencePill scope=${scopeExpression} />`)) {
    const start = source.indexOf(headerMatch);
    if (start < 0) fail(`Could not locate ${label} BackHeader.`);
    const end = source.indexOf('/>', start);
    if (end < 0) fail(`Could not locate end of ${label} BackHeader.`);
    const insertAt = end + 2;
    source = source.slice(0, insertAt) + `\n      <PartnerPresencePill scope=${scopeExpression} />` + source.slice(insertAt);
  } else {
    console.log(`Already good: ${label} presence pill`);
  }

  write(rel, source);
}

addPresenceImportAndPill(
  'src/app/features/decision-tools.tsx',
  '"decision-wheel"',
  '<BackHeader eyebrow="Together" title="Decision wheel"',
  'Decision Wheel',
);

addPresenceImportAndPill(
  'src/app/features/activities.tsx',
  '"date-ideas"',
  '<BackHeader eyebrow="Together" title="Date ideas"',
  'Date Ideas',
);

addPresenceImportAndPill(
  'src/app/features/trip-detail.tsx',
  '{`trip:${trip.id}`}',
  '<BackHeader eyebrow="Our trip" title={trip.title}',
  'Trip Hub',
);

// --- Audit -------------------------------------------------------------------

const audits = [
  ['server/src/realtime/hub.ts', ["scope: string | null;", "type: 'presence.snapshot'", "private broadcastPresence(coupleId: string)"]],
  ['src/services/backend/realtime.ts', ["type: 'presence.snapshot'", "claimPresence(scope: string)", "private syncPresence()"]],
  ['src/hooks/usePartnerPresence.ts', ["export function usePartnerPresence(scope: string)", "event.type !== 'presence.snapshot'"]],
  ['src/components/common/PartnerPresencePill.tsx', ["Waiting for", "is here ♥"]],
  ['src/app/features/decision-tools.tsx', ['<PartnerPresencePill scope="decision-wheel" />']],
  ['src/app/features/activities.tsx', ['<PartnerPresencePill scope="date-ideas" />']],
  ['src/app/features/trip-detail.tsx', ['<PartnerPresencePill scope={`trip:${trip.id}`} />']],
];

for (const [rel, markers] of audits) {
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`Post-apply audit missing ${marker} in ${rel}`);
  }
}

console.log('D7 Live Partner Presence audit clean.');

function run(args, label) {
  console.log(`\n> ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

run(['run', 'typecheck'], 'Frontend typecheck');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD7 Live Partner Presence applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
