import { backendConfig, getUsableAccessToken } from './api';

export type RealtimeResource = 'tasks' | 'notes' | 'lists' | 'countdowns' | 'events' | 'goals' | 'trips' | 'memories' | 'activities' | 'questions' | 'moods' | 'tags' | 'schedules' | 'games';

export type RealtimeEvent =
  | { type: 'ready'; coupleId: string | null }
  | { type: 'workspace.updated' }
  | { type: 'shared_item.updated'; sharedKey: string; itemId: string }
  | { type: 'feature.updated'; resource: RealtimeResource; action: string; id?: string }
  | { type: 'error'; message: string };

type Listener = (event: RealtimeEvent) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyStopped = true;

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
    this.socket?.close();
    this.socket = null;
    this.ensureConnected().catch(() => undefined);
  }

  private stop() {
    this.manuallyStopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private async ensureConnected() {
    if (!backendConfig.isConfigured || this.socket || this.manuallyStopped || this.listeners.size === 0) return;
    const accessToken = await getUsableAccessToken();
    if (!accessToken) return;
    const wsUrl = backendConfig.apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const socket = new WebSocket(`${wsUrl}/realtime`);
    this.socket = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', accessToken }));
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeEvent;
        for (const listener of this.listeners) listener(event);
      } catch {
        // Malformed realtime messages are ignored instead of disrupting the app.
      }
    };
    socket.onerror = () => undefined;
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      if (!this.manuallyStopped && this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.ensureConnected().catch(() => undefined), 2000);
      }
    };
  }
}

export const realtimeClient = new RealtimeClient();
