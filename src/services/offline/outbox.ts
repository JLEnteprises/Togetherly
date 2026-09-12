// Platform-independent durable outbox. Pending content is never represented as
// delivered; the API layer and status banner expose the separate sync state.
export type Row = Record<string, any>;
export type Operation = { id: string; path: string; method: string; body: Row; kind: string; localId: string; optimistic: Row; blocked?: string; prepared?: Row };
type State = { operations: Operation[]; snapshots: Record<string, any>; ids: Record<string, string>; versions: Record<string, { from?: string; prior?: string[]; to: string }> };
export type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export const kindFor = (path: string, method: string) => {
  if (/^\/tasks(?:\/[^/]+)?$/.test(path) && ['POST','PATCH','DELETE'].includes(method)) return 'task';
  if (/^\/tasks\/[^/]+\/subtasks$/.test(path) && method === 'POST' || /^\/task-subtasks\/[^/]+$/.test(path) && ['PATCH','DELETE'].includes(method)) return 'subtask';
  if (/^\/notes(?:\/[^/]+)?$/.test(path) && ['POST','PATCH','DELETE'].includes(method)) return 'note';
  return path === '/moods' && method === 'POST' ? 'mood' : null;
};
export class Outbox {
  private state: State = { operations: [], snapshots: {}, ids: {}, versions: {} };
  private serial: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  readonly ready: Promise<void>;
  constructor(private storage: Storage, private key: string, readonly userId: string, readonly coupleId: string, private changed: () => void) {
    this.ready = storage.getItem(key).then(raw => { if (raw) this.state = JSON.parse(raw); });
  }
  private edit<T>(fn: (next: State) => T): Promise<T> {
    const task = this.serial.then(async () => {
      await this.ready;
      const next = JSON.parse(JSON.stringify(this.state)) as State;
      const result = fn(next);
      await this.storage.setItem(this.key, JSON.stringify(next));
      this.state = next; this.changed(); return result;
    });
    this.serial = task.catch(() => undefined); return task;
  }
  hasSnapshot(path: string) { return this.state.snapshots[path] !== undefined; }
  record(op: Operation) {
    const id = this.state.ids[op.localId] ?? op.localId;
    return { ...op.optimistic, id };
  }
  get pending() { return this.state.operations.length; }
  get problem() { return this.state.operations.find(op => op.blocked)?.blocked; }
  get operations() { return this.state.operations; }
  async snapshot(path: string, value: any) {
    if (['/tasks','/notes','/moods/latest'].includes(path)) await this.edit(s => { s.snapshots[path] = value; });
    return this.project(path, value);
  }
  project(path: string, fallback?: any, operations = this.state.operations) {
    let result = JSON.parse(JSON.stringify(fallback ?? this.state.snapshots[path] ?? (path === '/moods/latest' ? { mine: null, partner: null } : {})));
    for (const op of operations) {
      if (op.kind === 'mood' && path === '/moods/latest') result.mine = op.optimistic;
      if (op.kind === 'task' && path === '/tasks' || op.kind === 'note' && path === '/notes') {
        const key = op.kind === 'task' ? 'tasks' : 'notes';
        const rows: Row[] = result[key] ?? [];
        const id = this.state.ids[op.localId] ?? op.localId;
        const existing = rows.find(row => row.id === id || row.id === op.localId);
        result[key] = rows.filter(row => row.id !== id && row.id !== op.localId);
        if (op.method !== 'DELETE') result[key].push({ ...existing, ...op.optimistic, id });
      }
      if (op.kind === 'subtask' && path === '/tasks') {
        for (const task of result.tasks ?? []) {
          if (task.id !== (this.state.ids[op.optimistic.task_id] ?? op.optimistic.task_id)) continue;
          const id = this.state.ids[op.localId] ?? op.localId;
          task.subtasks = (task.subtasks ?? []).filter((step: Row) => step.id !== id && step.id !== op.localId);
          if (op.method !== 'DELETE') task.subtasks.push({ ...op.optimistic, id });
        }
      }
    }
    return result;
  }
  async enqueue(path: string, method: string, body: Row, partnerId?: string) {
    path = path.split('/').map(part => this.state.ids[part] ?? part).join('/');
    const kind = kindFor(path, method);
    if (!kind) throw new Error('This action needs a connection.');
    // Construct inside the serial write so rapid taps see earlier pending edits.
    return this.edit(s => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      const localId = method === 'POST' ? `local-${id}` : path.split('/').pop()!;
      const list = this.project(kind === 'note' ? '/notes' : '/tasks');
      const rows: Row[] = kind === 'subtask' ? (list.tasks ?? []).flatMap((t: Row) => t.subtasks ?? []) : list[kind === 'note' ? 'notes' : 'tasks'] ?? [];
      const existing = rows.find(row => row.id === localId);
      if (method !== 'POST' && !existing) throw new Error('Open this item online once before editing it offline.');
      const now = new Date().toISOString();
      const translated = Object.fromEntries(Object.entries(body).map(([k,v]) => [k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`),v]));
      const optimistic: Row = { id: localId, couple_id: this.coupleId, creator_id: this.userId, user_id: this.userId,
        title: '', description: '', body: '', status: 'not_started', priority: 'normal', recurrence: 'none',
        due_date: null, start_date: null, estimated_minutes: null, tags: [], subtasks: [], pinned: false,
        visibility: 'shared', context: '', need: 'nothing', created_at: now, updated_at: now,
        completed: false, ...existing, ...translated };
      // Keep the last server revision until acknowledgement, never invent one.
      if (existing) optimistic.updated_at = existing.updated_at;
      if (kind === 'task' && (method === 'POST' || body.assignee !== undefined)) {
        optimistic.assign_to_both = !body.assignee || body.assignee === 'both';
        optimistic.assignee_id = body.assignee === 'me' ? this.userId : body.assignee === 'partner' ? partnerId : null;
      }
      if (kind === 'task' && method === 'POST') optimistic.subtasks = (body.subtasks ?? []).map((step: Row, index: number) => ({
        id: `${localId}-step-${index}`, task_id: localId, creator_id: this.userId, title: step.title, completed: false,
        due_date: step.dueDate ?? null, estimated_minutes: step.estimatedMinutes ?? null, sort_order: index, created_at: now, updated_at: now,
      }));
      if (kind === 'subtask') optimistic.task_id = existing?.task_id ?? path.split('/')[2];
      if (kind === 'mood') optimistic.valid_until = new Date(Date.now() + (body.validForHours ?? 12) * 3600000).toISOString();
      if (existing && body.updatedAt === undefined) body = { ...body, updatedAt: existing.updated_at };
      if (kind === 'mood') body = { ...body, recordedAt: now };
      const op: Operation = { id, path, method, body, kind, localId, optimistic };
      s.operations.push(op); return op;
    });
  }
  async discardAll() { if (this.flushing) throw new Error('Wait until syncing has finished.'); await this.edit(s => { s.operations = []; }); }
  flush(send: (payload: Row) => Promise<any>, active: () => boolean) {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      await this.ready;
      while (active() && this.state.operations.length) {
        const op = this.state.operations[0]!;
        if (op.blocked) return;
        if (!op.prepared) await this.edit(s => {
          const path = op.path.split('/').map(p => s.ids[p] ?? p).join('/');
          const body = { ...op.body };
          const id = s.ids[op.localId] ?? op.localId;
          const version = s.versions[id];
          if (version && (body.updatedAt === version.from || version.prior?.includes(body.updatedAt))) body.updatedAt = version.to;
          s.operations[0]!.prepared = { id: op.id, coupleId: this.coupleId, path, method: op.method, body };
        });
        const prepared = this.state.operations[0]!.prepared!;
        try {
          const response = await send(prepared);
          await this.edit(s => {
            const row = response.result?.[op.kind];
            if (row?.id) {
              s.ids[op.localId] = row.id;
              if (row.updated_at) {
                const previous = s.versions[row.id];
                const from = op.body.updatedAt ?? op.optimistic.updated_at;
                s.versions[row.id] = { from, to: row.updated_at, prior: [...new Set([
                  ...(previous?.prior ?? []), previous?.from, previous?.to, from, prepared.body.updatedAt,
                ].filter((v): v is string => typeof v === 'string'))] };
              }
              for (let i = 0; i < (op.method === 'POST' ? op.optimistic.subtasks ?? [] : []).length; i++) {
                const old = op.optimistic.subtasks[i]; const next = row.subtasks?.[i];
                if (next) { s.ids[old.id] = next.id; s.versions[next.id] = { from: old.updated_at, to: next.updated_at }; }
              }
            }
            const path = op.kind === 'note' ? '/notes' : op.kind === 'mood' ? '/moods/latest' : '/tasks';
            // Preserve an acknowledged copy while fresh reads are unavailable.
            const projected = this.project(path, undefined, [op]);
            const replace = (value: any): any => Array.isArray(value) ? value.map(replace) : value && typeof value === 'object' ?
              Object.fromEntries(Object.entries(value).map(([k,v]) => [k, k === 'id' || k === 'task_id' ? s.ids[String(v)] ?? v : replace(v)])) : value;
            s.snapshots[path] = replace(projected);
            if (row && op.kind === 'mood') s.snapshots[path].mine = row;
            if (row && ['task','note'].includes(op.kind)) {
              const key = op.kind === 'task' ? 'tasks' : 'notes';
              s.snapshots[path][key] = (s.snapshots[path][key] ?? []).map((v: Row) => v.id === row.id ? { ...v, ...row } : v);
            }
            if (row && op.kind === 'subtask') {
              for (const task of s.snapshots[path].tasks ?? []) {
                task.subtasks = (task.subtasks ?? []).map((step: Row) => step.id === row.id ? { ...step, ...row } : step);
              }
            }
            s.operations.shift();
          });
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status && status < 500 && status !== 408 && status !== 429 && status !== 401) {
            await this.edit(s => { s.operations[0]!.blocked = error instanceof Error ? error.message : 'This change needs review.'; });
          }
          throw error;
        }
      }
    })().finally(() => { this.flushing = null; this.changed(); });
    return this.flushing;
  }
}
