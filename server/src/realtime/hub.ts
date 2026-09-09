import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import { pool } from '../db/pool.js';
import { verifyAccessToken } from '../auth/tokens.js';

type ClientState = {
  userId: string | null;
  coupleId: string | null;
  scope: string | null;
};

type RealtimeEvent = {
  type: string;
  [key: string]: unknown;
};

export class RealtimeHub {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly states = new WeakMap<WebSocket, ClientState>();

  constructor(server: Server) {
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/realtime') return;
      this.wss.handleUpgrade(request, socket, head, (ws) => this.wss.emit('connection', ws, request));
    });

    this.wss.on('connection', (ws) => {
      this.states.set(ws, { userId: null, coupleId: null, scope: null });
      const timeout = setTimeout(() => ws.close(4401, 'Authentication timeout'), 10_000);
      let expiryTimeout: ReturnType<typeof setTimeout> | null = null;

      ws.on('message', async (raw) => {
        let message: unknown;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid realtime message.' }));
          return;
        }
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        const typed = message as { type: string; accessToken?: string; scope?: unknown };

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
        }
      });

      const clearTimers = () => {
        clearTimeout(timeout);
        if (expiryTimeout) clearTimeout(expiryTimeout);
      };
      ws.on('close', () => {
        const state = this.states.get(ws);
        clearTimers();
        if (state?.coupleId) this.broadcastPresence(state.coupleId);
      });
      ws.on('error', clearTimers);
    });
  }

  private broadcastPresence(coupleId: string) {
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

  broadcastCouple(coupleId: string, event: RealtimeEvent) {
    const payload = JSON.stringify(event);
    for (const client of this.wss.clients) {
      const state = this.states.get(client);
      if (state?.coupleId === coupleId && client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }
}
