import { backendConfig, getUsableAccessToken, initializeBackendConfig } from './api';

export type RealtimeResource = 'tasks' | 'notes' | 'lists' | 'countdowns' | 'events' | 'goals' | 'trips' | 'memories' | 'activities' | 'questions' | 'moods' | 'tags' | 'schedules' | 'games' | 'location' | 'relationship_pings' | 'decision_wheel';

export type RealtimeEvent =
  | { type: 'ready'; coupleId: string | null }
  | { type: 'workspace.updated' }
  | { type: 'shared_item.updated'; sharedKey: string; itemId: string }
  | { type: 'feature.updated'; resource: RealtimeResource; action: string; id?: string }
  | { type: 'presence.snapshot'; users: Array<{ userId: string; scope: string | null }> }
  | { type: 'error'; message: string };

type Listener = (event: RealtimeEvent) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyStopped = true;
  private lastRuntimeRefreshAt = 0;
  private ready = false;
  private readonly presenceClaims = new Map<symbol, string>();
  private presenceScope: string | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.manuallyStopped = false;
    this.ensureConnected().catch(() => undefined);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  restart() {
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
  }

  private stop() {
    this.manuallyStopped = true;
    this.ready = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private async ensureConnected(refreshRuntime = false) {
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
    const socket = new WebSocket(`${wsUrl}/realtime`);
    this.socket = socket;

    socket.onopen = () => {
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
    };
    socket.onerror = () => undefined;
    socket.onclose = () => {
      this.ready = false;
      if (this.socket === socket) this.socket = null;
      if (!this.manuallyStopped && this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.ensureConnected(true).catch(() => undefined), 2000);
      }
    };
  }
}

export const realtimeClient = new RealtimeClient();
