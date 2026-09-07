import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { buildApp } from './app.js';
import { pool } from './db/pool.js';

type Session = { user: { id: string; email: string; display_name: string }; accessToken: string; refreshToken: string };
type Json = Record<string, any>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const domain = `smoke-${stamp}.example.test`;
  const emails = {
    a: `purple@${domain}`,
    b: `green@${domain}`,
    c: `other@${domain}`,
    d: `unused@${domain}`,
    invalid: `invalid@${domain}`,
  };
  const app = await buildApp();
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  let base = '';
  const createdCoupleIds: string[] = [];
  const createdUserIds: string[] = [];

  const request = async <T = Json>(path: string, options: { method?: string; token?: string; body?: unknown; expected?: number | number[] } = {}): Promise<T> => {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const expected = Array.isArray(options.expected) ? options.expected : [options.expected ?? 200];
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;
    if (!expected.includes(response.status)) {
      throw new Error(`${options.method ?? 'GET'} ${path}: expected ${expected.join('/')} but got ${response.status}: ${text}`);
    }
    return payload as T;
  };

  const register = (email: string) => request<Session>('/auth/register', {
    method: 'POST',
    expected: 201,
    body: { email, password: 'SmokeTest!2026', timezone: 'Australia/Brisbane' },
  });

  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    base = address.replace(/\/$/, '');

    const health = await request<{ ok: boolean }>('/health');
    assert(health.ok === true, 'Health endpoint did not return ok=true.');
    console.log('PASS health endpoint');

    await request('/auth/register', {
      method: 'POST', expected: 400,
      body: { email: emails.invalid, password: 'SmokeTest!2026', displayName: 'Invalid TZ', timezone: 'Mars/Olympus_Mons' },
    });
    console.log('PASS invalid timezone rejected');

    const [a, b, c, d] = await Promise.all([
      register(emails.a),
      register(emails.b),
      register(emails.c),
      register(emails.d),
    ]);
    createdUserIds.push(a.user.id, b.user.id, c.user.id, d.user.id);
    assert(a.user.display_name === 'New member' && b.user.display_name === 'New member', 'Registration should defer display names to onboarding.');
    await request('/workspace/profile', { method: 'PATCH', token: a.accessToken, body: { displayName: 'Green Smoke', preferredColor: 'green', avatarUrl: tinyPng, onboardingComplete: false } });
    await request('/workspace/profile', { method: 'PATCH', token: b.accessToken, body: { displayName: 'Purple Smoke', preferredColor: 'purple', onboardingComplete: false } });
    await request('/workspace/profile', { method: 'PATCH', token: c.accessToken, body: { displayName: 'Other Couple', onboardingComplete: false } });
    await request('/workspace/profile', { method: 'PATCH', token: d.accessToken, body: { displayName: 'Unused Invite', onboardingComplete: false } });
    console.log('PASS registration defers real-user profile setup and onboarding profile updates persist');

    await request('/workspace/create', { method: 'POST', token: c.accessToken, expected: 400, body: { relationshipStartDate: '2026-02-31', longDistanceEnabled: false } });
    const cWorkspace = await request<{ coupleId: string; inviteCode: string }>('/workspace/create', { method: 'POST', token: c.accessToken, expected: 201, body: { relationshipStartDate: '2026-01-10', longDistanceEnabled: false } });
    assert(cWorkspace.coupleId, 'Other couple was not created.');
    createdCoupleIds.push(cWorkspace.coupleId);

    const aWorkspace = await request<{ coupleId: string; inviteCode: string; participantColor: string }>('/workspace/create', { method: 'POST', token: a.accessToken, expected: 201, body: { relationshipStartDate: '2026-01-02', longDistanceEnabled: true, participantColor: 'green' } });
    createdCoupleIds.push(aWorkspace.coupleId);
    await request('/workspace/join', { method: 'POST', token: b.accessToken, body: { inviteCode: aWorkspace.inviteCode } });
    await request('/workspace/join', { method: 'POST', token: d.accessToken, expected: 404, body: { inviteCode: aWorkspace.inviteCode } });

    const aSnapshot = await request<Json>('/workspace', { token: a.accessToken });
    const bSnapshot = await request<Json>('/workspace', { token: b.accessToken });
    assert(aSnapshot.couple.id === bSnapshot.couple.id, 'Linked partners do not share a couple id.');
    assert(aSnapshot.myColor === 'green' && bSnapshot.myColor === 'purple', 'Creator colour choice or opposite partner colour was not preserved.');
    assert(aSnapshot.profile.display_name === 'Green Smoke' && bSnapshot.profile.display_name === 'Purple Smoke', 'Onboarding names did not persist.');
    assert(aSnapshot.partnerProfile?.email === '' && bSnapshot.partnerProfile?.email === '', 'Workspace snapshot exposed a partner sign-in email.');
    assert(aSnapshot.profile.avatar_url === tinyPng, 'Profile photo chosen during onboarding did not persist.');
    console.log('PASS chosen participant colour, opposite join colour, invite single-use and real names');

    await request('/location/sharing', { method: 'PUT', token: a.accessToken, body: { enabled: true } });
    await request('/location/sharing', { method: 'PUT', token: b.accessToken, body: { enabled: true } });
    await request('/location/position', { method: 'PUT', token: a.accessToken, body: { latitude: -27.4698, longitude: 153.0251, accuracyM: 12, timezone: 'Australia/Brisbane' } });
    await request('/workspace/profile', { method: 'PATCH', token: b.accessToken, body: { timezone: 'America/Chicago', timezoneMode: 'manual' } });
    await request('/location/position', { method: 'PUT', token: b.accessToken, body: { latitude: 41.1538, longitude: -87.8875, accuracyM: 15, timezone: 'Australia/Brisbane' } });
    const locationView = await request<{ members: Json[] }>('/location', { token: a.accessToken });
    assert(locationView.members.filter((member) => member.sharingEnabled && member.latitude != null && member.longitude != null).length === 2, 'Linked partners could not see both shared locations.');
    const bAfterLocation = await request<Json>('/workspace', { token: b.accessToken });
    assert(bAfterLocation.profile.timezone === 'America/Chicago' && bAfterLocation.profile.timezone_mode === 'manual', 'A live location update overwrote a manually selected timezone.');
    await request('/location/sharing', { method: 'PUT', token: a.accessToken, body: { enabled: false } });
    const hiddenLocation = await request<{ members: Json[] }>('/location', { token: b.accessToken });
    const hiddenA = hiddenLocation.members.find((member) => member.userId === a.user.id);
    assert(hiddenA?.sharingEnabled === false && hiddenA?.latitude == null && hiddenA?.longitude == null, 'Turning location sharing off did not hide stored coordinates.');
    const clearedLocation = await pool.query('SELECT latitude,longitude,accuracy_m,captured_at FROM live_locations WHERE user_id=$1', [a.user.id]);
    assert(clearedLocation.rows[0]?.latitude == null && clearedLocation.rows[0]?.longitude == null && clearedLocation.rows[0]?.accuracy_m == null && clearedLocation.rows[0]?.captured_at == null, 'Turning location sharing off retained precise coordinates in the database.');
    await request('/workspace/profile', { method: 'PATCH', token: b.accessToken, body: { timezone: 'Australia/Brisbane', timezoneMode: 'automatic' } });
    console.log('PASS live location visibility, location-off privacy and manual-timezone protection');

    await request('/workspace/join', { method: 'POST', token: d.accessToken, body: { inviteCode: cWorkspace.inviteCode } });
    await request('/workspace/remove-partner', { method: 'POST', token: c.accessToken });
    const removedSnapshot = await request<Json>('/workspace', { token: d.accessToken });
    assert(removedSnapshot.couple === null, 'Unlinked account still has access to its previous couple space.');
    console.log('PASS owner can unlink a partner and removed account loses couple access');

    const realtimeEvent = new Promise<Json>((resolve, reject) => {
      const wsUrl = base.replace(/^http/, 'ws') + '/realtime';
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => { ws.close(); reject(new Error('Realtime event timed out.')); }, 5000);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', accessToken: b.accessToken })));
      ws.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as Json;
        if (message.type === 'feature.updated' && message.resource === 'tasks' && message.action === 'created') {
          clearTimeout(timer); ws.close(); resolve(message);
        }
      });
      ws.on('error', (error) => { clearTimeout(timer); reject(error); });
    });

    const tag = (await request<{ tag: Json }>('/tags', { method: 'POST', token: a.accessToken, expected: 201, body: { name: `Smoke ${stamp}`, icon: '✦' } })).tag;
    const drawnTag = (await request<{ tag: Json }>('/tags', { method: 'POST', token: a.accessToken, expected: 201, body: { name: `Drawn ${stamp}`, iconDrawing: { version: 1, strokes: [{ id: 'icon-stroke', points: [{ x: 100, y: 100 }, { x: 900, y: 900 }], width: 7 }] } } })).tag;
    assert(drawnTag.icon_drawing?.strokes?.length === 1, 'Hand-drawn tag icon did not persist.');
    const beforeC = await request<{ tasks: Json[] }>('/tasks', { token: c.accessToken });
    await request('/tasks', { method: 'POST', token: c.accessToken, expected: 400, body: { title: 'Must not persist', tagIds: [tag.id] } });
    const afterC = await request<{ tasks: Json[] }>('/tasks', { token: c.accessToken });
    assert(afterC.tasks.length === beforeC.tasks.length, 'A failed cross-couple tag validation still created a task.');
    console.log('PASS cross-couple tag validation is atomic before task creation');

    const task = (await request<{ task: Json }>('/tasks', {
      method: 'POST', token: a.accessToken, expected: 201,
      body: { title: 'Realtime smoke task', description: 'Created by purple', assignee: 'both', priority: 'high', dueDate: '2026-08-25', tagIds: [tag.id], subtasks: [{ title: 'Initial checklist step', dueDate: '2026-08-24', estimatedMinutes: 30 }] },
    })).task;
    const event = await realtimeEvent;
    assert(event.id === task.id, 'Realtime task event referenced the wrong item.');
    await request(`/tasks/${task.id}`, { method: 'PATCH', token: a.accessToken, body: { tagIds: [drawnTag.id] } });
    const drawnTaggedTask = (await request<{ tasks: Json[] }>('/tasks', { token: b.accessToken })).tasks.find((item) => item.id === task.id);
    assert(drawnTaggedTask?.tags?.[0]?.icon_drawing?.strokes?.length === 1, 'Drawn Tag icon did not propagate through tagged content.');
    assert(drawnTaggedTask?.subtasks?.length === 1 && drawnTaggedTask.subtasks[0].title === 'Initial checklist step' && Number(drawnTaggedTask.subtasks[0].estimated_minutes) === 30, 'Checklist steps created with the task did not persist.');
    const bTasks = await request<{ tasks: Json[] }>('/tasks', { token: b.accessToken });
    assert(bTasks.tasks.some((item) => item.id === task.id), 'Partner cannot see shared task.');
    await request(`/tasks/${task.id}`, { method: 'PATCH', token: c.accessToken, expected: 404, body: { status: 'completed' } });
    await request('/tasks/not-a-uuid', { method: 'PATCH', token: a.accessToken, expected: 400, body: { status: 'completed' } });
    assert(!(await request<{ tasks: Json[] }>('/tasks', { token: c.accessToken })).tasks.some((item) => item.id === task.id), 'Other couple can see task.');
    const versionedTask = (await request<{ tasks: Json[] }>('/tasks', { token: a.accessToken })).tasks.find((item) => item.id === task.id);
    assert(versionedTask?.updated_at, 'Task did not expose an updated_at version.');
    await request(`/tasks/${task.id}`, { method: 'PATCH', token: a.accessToken, body: { description: 'First concurrent edit', updatedAt: versionedTask.updated_at } });
    await request(`/tasks/${task.id}`, { method: 'PATCH', token: b.accessToken, expected: 409, body: { description: 'Stale concurrent edit', updatedAt: versionedTask.updated_at } });
    console.log('PASS stale task edits are rejected instead of overwriting partner changes');
    console.log('PASS realtime delivery, create-with-checklist, invalid-id handling and cross-couple task isolation');

    const recurringTask = (await request<{ task: Json }>('/tasks', {
      method: 'POST', token: a.accessToken, expected: 201,
      body: { title: 'Month-end recurring task', assignee: 'both', startDate: '2026-10-24', dueDate: '2026-10-31', estimatedMinutes: 10080, recurrence: 'monthly', tagIds: [tag.id] },
    })).task;
    const repeatTag = (await request<{ tag: Json }>('/tags', { method: 'POST', token: b.accessToken, expected: 201, body: { name: `Repeat ${stamp}`, icon: '↻' } })).tag;
    const subtask = (await request<{ subtask: Json }>(`/tasks/${recurringTask.id}/subtasks`, { method: 'POST', token: b.accessToken, expected: 201, body: { title: 'Recurring checklist step', dueDate: '2026-10-28', estimatedMinutes: 120 } })).subtask;
    await request(`/task-subtasks/${subtask.id}`, { method: 'PATCH', token: a.accessToken, body: { completed: true } });
    const repeatResult = await request<{ task: Json; nextTaskId: string }>(`/tasks/${recurringTask.id}`, { method: 'PATCH', token: b.accessToken, body: { status: 'completed', tagIds: [repeatTag.id] } });
    assert(Boolean(repeatResult.nextTaskId), 'Completing a recurring task did not generate the next occurrence.');
    const repeatedTasks = await request<{ tasks: Json[] }>('/tasks', { token: a.accessToken });
    const nextOccurrence = repeatedTasks.tasks.find((item) => item.id === repeatResult.nextTaskId);
    assert(nextOccurrence?.due_date === '2026-11-30', `Monthly task recurrence did not clamp Oct 31 to Nov 30 (got ${nextOccurrence?.due_date}).`);
    assert(nextOccurrence?.occurrence_number === 2, 'Recurring task occurrence number did not advance.');
    assert(nextOccurrence?.start_date === '2026-11-24' && Number(nextOccurrence?.estimated_minutes) === 10080, 'Recurring task did not preserve smart timing.');
    assert(nextOccurrence?.tags?.length === 1 && nextOccurrence.tags[0].id === repeatTag.id, 'Recurring task did not inherit tags changed during completion.');
    assert(nextOccurrence?.subtasks?.length === 1 && nextOccurrence.subtasks[0].completed === false, 'Recurring task did not copy its checklist as incomplete.');
    assert(nextOccurrence?.subtasks?.[0]?.due_date === '2026-11-28' && Number(nextOccurrence?.subtasks?.[0]?.estimated_minutes) === 120, 'Recurring checklist step did not preserve its own due date and duration.');
    await request(`/task-subtasks/${subtask.id}`, { method: 'PATCH', token: c.accessToken, expected: 404, body: { completed: false } });
    console.log('PASS recurring tasks, smart timing, step deadlines, month-end clamping, tag/checklist copying and subtask isolation');

    const privateNote = (await request<{ note: Json }>('/notes', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Purple private', body: 'secret', visibility: 'private' } })).note;
    const sharedNote = (await request<{ note: Json }>('/notes', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Shared smoke note', body: 'visible', visibility: 'shared', tagIds: [tag.id] } })).note;
    const bNotes = await request<{ notes: Json[] }>('/notes', { token: b.accessToken });
    assert(!bNotes.notes.some((note) => note.id === privateNote.id), 'Private note leaked to partner.');
    assert(bNotes.notes.some((note) => note.id === sharedNote.id), 'Shared note is not visible to partner.');
    await request(`/notes/${privateNote.id}`, { method: 'PATCH', token: b.accessToken, expected: 404, body: { title: 'stolen' } });
    console.log('PASS private/shared note permissions');

    const scratchpad = (await request<{ item: Json }>('/shared-items/scratchpad', { method: 'PUT', token: a.accessToken, body: { body: 'Home scratch note', mode: 'draw', drawing: { version: 1, strokes: [{ id: 'scratch-stroke', userId: a.user.id, points: [{ x: 120, y: 140 }, { x: 700, y: 650 }], width: 7 }] } } })).item;
    assert(scratchpad.body === 'Home scratch note' && scratchpad.metadata?.mode === 'draw' && scratchpad.metadata?.drawing?.strokes?.length === 1, 'Text/draw scratchpad content did not persist.');
    const partnerScratchpad = (await request<{ item: Json | null }>('/shared-items/scratchpad', { token: b.accessToken })).item;
    assert(partnerScratchpad?.metadata?.drawing?.strokes?.length === 1, 'Shared scratchpad drawing was not visible to partner.');
    console.log('PASS shared scratchpad text/draw persistence');

    const exportedB = await request<{ export: Json }>('/auth/export', { token: b.accessToken });
    const exportedNotes = Array.isArray(exportedB.export.notes) ? exportedB.export.notes as Json[] : [];
    assert(exportedNotes.some((note) => note.id === sharedNote.id), 'Data export omitted accessible shared content.');
    assert(!exportedNotes.some((note) => note.id === privateNote.id), 'Data export leaked a partner private note.');
    const serializedExport = JSON.stringify(exportedB.export);
    assert(!serializedExport.includes('password_hash') && !serializedExport.includes('refresh_token_hash'), 'Data export contained authentication secrets.');
    assert(exportedB.export.partner_profile?.email === undefined, 'Data export exposed the linked account’s private sign-in email.');
    console.log('PASS account data export respects privacy and excludes auth secrets');

    const list = (await request<{ list: Json }>('/lists', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Packing', tagIds: [tag.id] } })).list;
    const listItem = (await request<{ item: Json }>(`/lists/${list.id}/items`, { method: 'POST', token: b.accessToken, expected: 201, body: { title: 'Passport', priority: 'high' } })).item;
    await request(`/list-items/${listItem.id}`, { method: 'PATCH', token: a.accessToken, body: { completed: true } });
    const loadedList = await request<{ list: Json; items: Json[] }>(`/lists/${list.id}`, { token: b.accessToken });
    assert(loadedList.items.some((item) => item.id === listItem.id && item.completed === true), 'List item completion did not persist.');
    await request(`/list-items/${listItem.id}`, { method: 'DELETE', token: b.accessToken, expected: 204 });
    await request(`/lists/${list.id}`, { method: 'PATCH', token: a.accessToken, body: { title: 'October Packing', tagIds: [tag.id] } });
    console.log('PASS list create/rename/item add/update/delete');

    await request('/countdowns', { method: 'POST', token: a.accessToken, expected: 400, body: { title: 'Bad window', startAt: '2026-10-23T00:00:00.000Z', targetAt: '2026-10-22T00:00:00.000Z', type: 'visit' } });
    const countdown = (await request<{ countdown: Json }>('/countdowns', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Next visit', startAt: '2026-08-20T00:00:00.000Z', targetAt: '2026-10-22T00:00:00.000Z', type: 'visit' } })).countdown;
    await request(`/countdowns/${countdown.id}`, { method: 'PATCH', token: b.accessToken, body: { title: 'Next visit together' } });
    console.log('PASS countdown validation/create/edit');

    const calendarEvent = (await request<{ event: Json }>('/events', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Monthly date', startAt: '2026-10-31T10:00:00.000Z', recurrence: 'monthly', assignee: 'both', tagIds: [tag.id] } })).event;
    await request(`/events/${calendarEvent.id}`, { method: 'PATCH', token: b.accessToken, body: { location: 'Home' } });
    assert((await request<{ events: Json[] }>('/events', { token: b.accessToken })).events.some((item) => item.id === calendarEvent.id), 'Calendar event is not shared.');
    const allDayEvent = (await request<{ event: Json }>('/events', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Trip dates', startAt: '2026-10-22T12:00:00.000Z', endAt: '2026-10-30T12:00:00.000Z', startDate: '2026-10-22', endDate: '2026-10-30', allDay: true, assignee: 'both' } })).event;
    assert(allDayEvent.start_date === '2026-10-22' && allDayEvent.end_date === '2026-10-30', 'All-day calendar dates were not preserved as timezone-free dates.');
    const allDayFromPartner = (await request<{ events: Json[] }>('/events', { token: b.accessToken })).events.find((item) => item.id === allDayEvent.id);
    assert(allDayFromPartner?.start_date === '2026-10-22' && allDayFromPartner?.end_date === '2026-10-30', 'Partner view changed an all-day event date.');
    console.log('PASS calendar create/edit/share, recurrence and timezone-free all-day dates');

    const goal = (await request<{ goal: Json }>('/goals', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Visit fund', currentValue: 0, targetValue: 100, unit: '$', tagIds: [tag.id] } })).goal;
    const progressed = (await request<{ goal: Json }>(`/goals/${goal.id}/contributions`, { method: 'POST', token: b.accessToken, expected: 201, body: { amount: 100, note: 'Done' } })).goal;
    assert(progressed.status === 'completed', 'Goal did not complete at target.');
    console.log('PASS shared goal contribution/completion logic');

    const trip = (await request<{ trip: Json }>('/trips', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'Smoke trip', destination: 'Chicago', startDate: '2026-10-22', endDate: '2026-10-30', tagIds: [tag.id] } })).trip;
    const editedTrip = (await request<{ trip: Json }>(`/trips/${trip.id}`, { method: 'PATCH', token: b.accessToken, body: { notes: 'Partner edited this.' } })).trip;
    assert(editedTrip.start_date === '2026-10-22' && editedTrip.end_date === '2026-10-30', 'Partial trip edit changed or misread the trip date range.');
    console.log('PASS trip create/partial-edit/date preservation');
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: a.accessToken, expected: 201, body: { entityType: 'list', entityId: list.id } });
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: b.accessToken, expected: 201, body: { entityType: 'goal', entityId: goal.id } });
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: a.accessToken, expected: 201, body: { entityType: 'countdown', entityId: countdown.id } });
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: b.accessToken, expected: 201, body: { entityType: 'event', entityId: allDayEvent.id } });
    const tripDetail = await request<{ trip: Json; links: Json[] }>(`/trips/${trip.id}`, { token: b.accessToken });
    assert(tripDetail.links.length === 4, `Trip planner expected 4 linked items, got ${tripDetail.links.length}.`);
    await request(`/trips/${trip.id}/links/list/${list.id}`, { method: 'DELETE', token: b.accessToken, expected: 204 });
    assert((await request<{ trip: Json; links: Json[] }>(`/trips/${trip.id}`, { token: a.accessToken })).links.length === 3, 'Trip unlink did not persist.');
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: c.accessToken, expected: 404, body: { entityType: 'list', entityId: list.id } });
    await request(`/trips/${trip.id}/links`, { method: 'POST', token: a.accessToken, expected: 201, body: { entityType: 'list', entityId: list.id } });
    await request(`/lists/${list.id}`, { method: 'DELETE', token: b.accessToken, expected: 204 });
    const tripAfterLinkedDelete = await request<{ trip: Json; links: Json[] }>(`/trips/${trip.id}`, { token: a.accessToken });
    assert(tripAfterLinkedDelete.links.length === 3 && !tripAfterLinkedDelete.links.some((item) => item.entity_type === 'list'), 'Deleting a linked list left a stale Trip link.');
    const tripSummaryAfterLinkedDelete = (await request<{ trips: Json[] }>('/trips', { token: a.accessToken })).trips.find((item) => item.id === trip.id);
    assert(Number(tripSummaryAfterLinkedDelete?.link_count) === 3, 'Trip link count stayed stale after deleting a linked item.');
    console.log('PASS trip planner links, linked-item cleanup and cross-couple isolation');

    const memory = (await request<{ memory: Json }>('/memories', { method: 'POST', token: a.accessToken, expected: 201, body: { title: 'First smoke memory', memoryDate: '2026-07-25', photoUrls: [tinyPng, tinyPng], isMilestone: true, tagIds: [tag.id] } })).memory;
    const loadedMemories = await request<{ memories: Json[] }>('/memories', { token: b.accessToken });
    const loadedMemory = loadedMemories.memories.find((item) => item.id === memory.id);
    assert(loadedMemory?.photos?.length === 2, `Multi-photo memory expected 2 photos, got ${loadedMemory?.photos?.length}.`);
    assert(loadedMemory?.photo_url === tinyPng, 'Memory primary-photo compatibility field did not persist.');
    const album = (await request<{ album: Json }>('/memory-albums', { method: 'POST', token: b.accessToken, expected: 201, body: { title: 'Smoke album', description: 'Two-person album test' } })).album;
    await request(`/memory-albums/${album.id}/memories`, { method: 'POST', token: a.accessToken, expected: 201, body: { memoryId: memory.id } });
    const albumDetail = await request<{ album: Json; memories: Json[] }>(`/memory-albums/${album.id}`, { token: b.accessToken });
    assert(albumDetail.memories.some((item) => item.id === memory.id), 'Memory album did not contain the linked memory.');
    const timeline = await request<{ milestones: Json[] }>('/timeline', { token: b.accessToken });
    assert(timeline.milestones.some((item) => item.id === memory.id), 'Milestone memory did not appear on timeline.');
    const jar = await request<{ memory: Json | null }>('/memory-jar/random', { token: b.accessToken });
    assert(jar.memory?.id === memory.id, 'Memory jar did not return the only memory.');
    console.log('PASS multi-photo memories, albums, timeline and memory jar');

    const activity = (await request<{ activity: Json }>('/activities', { method: 'POST', token: a.accessToken, expected: 201, body: {
      title: 'Stargazing smoke', costLevel: 'free', durationMinutes: 60, locationType: 'nearby', environment: 'outdoor', timeOfDay: 'night', mood: 'romantic', kidFriendly: true, tagIds: [tag.id],
    } })).activity;
    const random = await request<{ activity: Json | null }>(`/activities/random?cost=free&locationType=nearby&environment=outdoor&mood=romantic&timeOfDay=night&maxMinutes=90&kidFriendly=true&tagIds=${tag.id}`, { token: b.accessToken });
    assert(random.activity?.id === activity.id, 'Strict randomiser filters did not return the matching activity.');
    const noMatch = await request<{ activity: Json | null }>('/activities/random?cost=expensive&environment=indoor', { token: b.accessToken });
    assert(noMatch.activity === null, 'Randomiser incorrectly fell back to an unfiltered activity.');
    console.log('PASS activity library and strict randomiser filters');

    const firstQuestion = await request<Json>('/daily-question', { token: a.accessToken });
    assert(firstQuestion.question?.id, 'Daily question was not seeded.');
    await request('/daily-question/answer', { method: 'POST', token: a.accessToken, body: { questionId: firstQuestion.question.id, answer: 'Purple answer' } });
    const historyBeforeBoth = await request<{ history: Json[] }>('/daily-question/history?limit=10', { token: a.accessToken });
    const partialHistory = historyBeforeBoth.history.find((entry) => entry.question?.id === firstQuestion.question.id);
    assert(partialHistory?.myAnswer?.answer === 'Purple answer' && partialHistory?.partnerAnswer === null, 'Daily Question history exposed a partner answer before both answered.');
    const beforePartnerAnswer = await request<Json>('/daily-question', { token: b.accessToken });
    assert(beforePartnerAnswer.partnerAnswer === null && beforePartnerAnswer.bothAnswered === false, 'Answer revealed before both partners answered.');
    await request('/daily-question/answer', { method: 'POST', token: b.accessToken, body: { questionId: firstQuestion.question.id, answer: 'Green answer' } });
    const afterBoth = await request<Json>('/daily-question', { token: a.accessToken });
    assert(afterBoth.bothAnswered === true && afterBoth.partnerAnswer?.answer === 'Green answer', 'Answers did not reveal after both partners answered.');
    await request('/daily-question/answer', { method: 'POST', token: a.accessToken, expected: 409, body: { questionId: firstQuestion.question.id, answer: 'Changed after reveal' } });
    console.log('PASS daily-question hidden-until-both-answer logic and post-reveal answer lock');

    const questionHistory = await request<{ history: Json[] }>('/daily-question/history?limit=10', { token: a.accessToken });
    const todayHistory = questionHistory.history.find((entry) => entry.question?.id === firstQuestion.question.id);
    assert(todayHistory?.myAnswer?.answer === 'Purple answer' && todayHistory?.partnerAnswer?.answer === 'Green answer' && todayHistory?.bothAnswered === true, 'Daily Question history did not preserve both revealed answers.');
    console.log('PASS daily-question history');

    await request('/moods', { method: 'POST', token: a.accessToken, expected: 201, body: { mood: 'good', need: 'nothing', visibility: 'private' } });
    const privateMoodView = await request<Json>('/moods/latest', { token: b.accessToken });
    assert(privateMoodView.partner === null, 'Private mood leaked to partner.');
    await request('/moods', { method: 'POST', token: a.accessToken, expected: 201, body: { mood: 'amazing', need: 'affection', visibility: 'shared' } });
    const sharedMoodView = await request<Json>('/moods/latest', { token: b.accessToken });
    assert(sharedMoodView.partner?.mood === 'amazing', 'Shared mood was not visible to partner.');
    console.log('PASS private/shared mood visibility');

    // Give both partners broad recurring Free windows so overlap discovery can be
    // verified independently of the weekday/time at which this smoke test runs.
    for (let day = 0; day < 7; day += 1) {
      await request('/schedules', { method: 'POST', token: a.accessToken, expected: 201, body: { label: 'Free', kind: 'free', dayOfWeek: day, startMinute: 0, endMinute: 1439 } });
      await request('/schedules', { method: 'POST', token: b.accessToken, expected: 201, body: { label: 'Free', kind: 'free', dayOfWeek: day, startMinute: 0, endMinute: 1439 } });
    }
    const overnightSleep = (await request<{ schedule: Json }>('/schedules', { method: 'POST', token: a.accessToken, expected: 201, body: { label: 'Sleep', kind: 'sleep', dayOfWeek: 1, startMinute: 1320, endMinute: 420 } })).schedule;
    const scheduleView = await request<{ schedules: Json[] }>('/schedules', { token: b.accessToken });
    assert(scheduleView.schedules.length >= 15 && scheduleView.schedules.some((item) => item.id === overnightSleep.id), 'Shared schedule view did not include both partners’ recurring windows or an overnight window.');
    const overlapView = await request<{ overlaps: Json[] }>('/availability/overlaps?days=3&minMinutes=30', { token: a.accessToken });
    const firstOverlap = overlapView.overlaps[0];
    assert(firstOverlap && firstOverlap.durationMinutes >= 30, 'Availability engine did not find a common Free window.');
    const foreignSchedule = (await request<{ schedules: Json[] }>('/schedules', { token: a.accessToken })).schedules.find((item) => item.user_id === b.user.id);
    assert(foreignSchedule, 'Could not find partner schedule for permission test.');
    await request(`/schedules/${foreignSchedule.id}`, { method: 'PATCH', token: a.accessToken, expected: 404, body: { label: 'Stolen' } });
    console.log('PASS recurring/overnight availability windows, overlap discovery and schedule ownership');


    const bingoGame = (await request<{ game: Json }>('/games', { method: 'POST', token: a.accessToken, expected: 201, body: { gameType: 'bingo', reward: 'Smoke reward', winCondition: 'line' } })).game;
    const aBingoCard = bingoGame.state.cards[a.user.id] as Json[];
    const claimSquare = aBingoCard.find((square) => square.kind === 'claim' && !square.completed);
    assert(claimSquare, 'Bingo did not generate a claimable square.');
    await request(`/games/${bingoGame.id}/actions`, { method: 'POST', token: a.accessToken, body: { action: 'claim', ownerUserId: a.user.id, squareId: claimSquare.id } });
    const bBingoView = (await request<{ game: Json }>(`/games/${bingoGame.id}`, { token: b.accessToken })).game;
    assert(bBingoView.state.cards[a.user.id].some((square: Json) => square.id === claimSquare.id && square.pending === true), 'Partner could not see a pending Bingo claim.');
    await request(`/games/${bingoGame.id}/actions`, { method: 'POST', token: b.accessToken, body: { action: 'confirm', ownerUserId: a.user.id, squareId: claimSquare.id } });
    const confirmedBingo = (await request<{ game: Json }>(`/games/${bingoGame.id}`, { token: a.accessToken })).game;
    assert(confirmedBingo.state.cards[a.user.id].some((square: Json) => square.id === claimSquare.id && square.completed === true), 'Verified Bingo square did not complete.');
    await request(`/games/${bingoGame.id}`, { token: c.accessToken, expected: 404 });
    console.log('PASS Relationship Bingo shared cards, partner verification and cross-couple isolation');

    const hangmanGame = (await request<{ game: Json }>('/games', { method: 'POST', token: a.accessToken, expected: 201, body: { gameType: 'hangman', secretWord: 'DINOSAUR' } })).game;
    assert(hangmanGame.state.secretWord === 'DINOSAUR', 'Hangman host cannot see their own secret.');
    const hiddenHangman = (await request<{ game: Json }>(`/games/${hangmanGame.id}`, { token: b.accessToken })).game;
    assert(hiddenHangman.state.secretWord === undefined && String(hiddenHangman.state.maskedWord).includes('_'), 'Hangman leaked the secret word to the guesser.');
    await request(`/games/${hangmanGame.id}/actions`, { method: 'POST', token: b.accessToken, body: { action: 'guess_letter', letter: 'D' } });
    const guessedHangman = (await request<{ game: Json }>(`/games/${hangmanGame.id}`, { token: b.accessToken })).game;
    assert(String(guessedHangman.state.maskedWord).startsWith('D'), 'Correct Hangman letter did not reveal in the masked word.');
    console.log('PASS Hangman secret redaction and guessing');

    const thisOrThat = (await request<{ game: Json }>('/games', { method: 'POST', token: a.accessToken, expected: 201, body: { gameType: 'this_or_that', roundCount: 5 } })).game;
    await request(`/games/${thisOrThat.id}/actions`, { method: 'POST', token: a.accessToken, body: { action: 'answer', choice: 'left' } });
    const bBeforeChoice = (await request<{ game: Json }>(`/games/${thisOrThat.id}`, { token: b.accessToken })).game;
    assert(bBeforeChoice.state.answers['0']?.[a.user.id] === undefined, 'This or That exposed the partner choice before both answered.');
    await request(`/games/${thisOrThat.id}/actions`, { method: 'POST', token: b.accessToken, body: { action: 'answer', choice: 'right' } });
    const revealedChoices = (await request<{ game: Json }>(`/games/${thisOrThat.id}`, { token: a.accessToken })).game;
    assert(revealedChoices.state.currentRevealed === true && revealedChoices.state.answers['0'][b.user.id] === 'right', 'This or That did not reveal both choices after both answered.');
    console.log('PASS This or That hidden simultaneous choices and reveal');

    const knowMe = (await request<{ game: Json }>('/games', { method: 'POST', token: a.accessToken, expected: 201, body: { gameType: 'know_me', roundCount: 4 } })).game;
    const firstKnowRound = knowMe.state.rounds[0];
    const subjectIsA = firstKnowRound.subjectUserId === a.user.id;
    const subjectSession = subjectIsA ? a : b;
    const guesserSession = subjectIsA ? b : a;
    await request(`/games/${knowMe.id}/actions`, { method: 'POST', token: subjectSession.accessToken, body: { action: 'answer', choiceIndex: 0 } });
    const guesserHiddenView = (await request<{ game: Json }>(`/games/${knowMe.id}`, { token: guesserSession.accessToken })).game;
    assert(guesserHiddenView.state.subjectLocked === true && guesserHiddenView.state.answers['0']?.subject === undefined, 'Know Me exposed the subject answer before the guess.');
    await request(`/games/${knowMe.id}/actions`, { method: 'POST', token: guesserSession.accessToken, body: { action: 'answer', choiceIndex: 0 } });
    const knowReveal = (await request<{ game: Json }>(`/games/${knowMe.id}`, { token: subjectSession.accessToken })).game;
    assert(knowReveal.state.currentRevealed === true && knowReveal.state.answers['0'].subject === 0 && knowReveal.state.answers['0'].guess === 0, 'Know Me did not reveal the completed round.');
    console.log('PASS How Well Do You Know Me hidden answer, prediction and reveal');

    const drawTogether = (await request<{ game: Json }>('/games', { method: 'POST', token: a.accessToken, expected: 201, body: { gameType: 'draw_together' } })).game;
    await request(`/games/${drawTogether.id}/actions`, { method: 'POST', token: a.accessToken, body: { action: 'draw_stroke', stroke: { id: 'smoke-draw', points: [{ x: 100, y: 120 }, { x: 400, y: 450 }, { x: 800, y: 700 }], width: 7 } } });
    const partnerDrawing = (await request<{ game: Json }>(`/games/${drawTogether.id}`, { token: b.accessToken })).game;
    assert(partnerDrawing.state.strokes?.length === 1 && partnerDrawing.state.strokes[0].userId === a.user.id, 'Draw Together did not share the completed stroke with the partner.');
    await request(`/games/${drawTogether.id}/actions`, { method: 'POST', token: a.accessToken, body: { action: 'undo_stroke' } });
    const undoneDrawing = (await request<{ game: Json }>(`/games/${drawTogether.id}`, { token: b.accessToken })).game;
    assert(undoneDrawing.state.strokes?.length === 0, 'Draw Together undo did not remove the author’s latest stroke.');
    console.log('PASS Draw Together shared strokes and per-author undo');

    const search = await request<{ results: Json[] }>('/search?q=smoke', { token: b.accessToken });
    assert(search.results.some((item) => item.id === sharedNote.id), 'Shared note missing from partner search.');
    assert(!search.results.some((item) => item.id === privateNote.id), 'Private note leaked through search.');
    console.log('PASS global-search privacy');

    const notifications = await request<{ notifications: Json[]; unreadCount: number }>('/notifications', { token: b.accessToken });
    assert(notifications.unreadCount > 0, 'Partner did not receive any in-app notifications.');
    const oneNotification = notifications.notifications[0];
    assert(oneNotification, 'Notification feed is empty.');
    await request(`/notifications/${oneNotification.id}/read`, { method: 'POST', token: b.accessToken });
    await request('/notifications/read-all', { method: 'POST', token: b.accessToken });
    assert((await request<{ unreadCount: number }>('/notifications', { token: b.accessToken })).unreadCount === 0, 'Mark-all-read did not clear unread count.');

    await request('/preferences', { method: 'PATCH', token: b.accessToken, body: { notificationTasks: false } });
    const mutedTitle = `Muted task ${stamp}`;
    await request('/tasks', { method: 'POST', token: a.accessToken, expected: 201, body: { title: mutedTitle, assignee: 'both' } });
    const mutedFeed = await request<{ notifications: Json[] }>('/notifications', { token: b.accessToken });
    assert(!mutedFeed.notifications.some((item) => item.kind === 'task' && item.body === mutedTitle), 'Disabled task notifications still created an inbox item.');
    await request('/preferences', { method: 'PATCH', token: b.accessToken, body: { notificationTasks: true } });
    console.log('PASS in-app notifications, read state and preference suppression');

    const dueSoonTitle = `Due soon ${stamp}`;
    await request('/tasks', { method: 'POST', token: a.accessToken, expected: 201, body: { title: dueSoonTitle, assignee: 'both', dueAt: new Date(Date.now() + 60 * 60_000).toISOString() } });
    await request('/notifications/reminders/refresh', { method: 'POST', token: b.accessToken });
    await request('/notifications/reminders/refresh', { method: 'POST', token: b.accessToken });
    const reminderFeed = await request<{ notifications: Json[] }>('/notifications', { token: b.accessToken });
    const scheduledTaskReminders = reminderFeed.notifications.filter((item) => item.title === 'Task due soon' && item.body === dueSoonTitle);
    assert(scheduledTaskReminders.length === 1, 'Scheduled task reminder was missing or was not deduplicated.');
    console.log('PASS scheduled in-app reminders and deduplication');

    await request('/workspace/colors/swap', { method: 'POST', token: a.accessToken });
    const swappedA = await request<Json>('/workspace', { token: a.accessToken });
    const swappedB = await request<Json>('/workspace', { token: b.accessToken });
    assert(swappedA.myColor === 'purple' && swappedB.myColor === 'green', 'Participant colours did not swap consistently.');
    assert(swappedA.profile.preferred_participant_color === 'purple' && swappedB.profile.preferred_participant_color === 'green', 'Preferred colours did not stay in sync after swap.');
    console.log('PASS dual-colour identity swap');

    const changedEmail = `account-${stamp}@example.test`;
    await request('/auth/email', { method: 'PATCH', token: d.accessToken, expected: 401, body: { email: changedEmail, currentPassword: 'wrong-password' } });
    await request('/auth/email', { method: 'PATCH', token: d.accessToken, body: { email: changedEmail, currentPassword: 'SmokeTest!2026' } });
    await request('/auth/login', { method: 'POST', expected: 401, body: { email: emails.d, password: 'SmokeTest!2026' } });
    const dByNewEmail = await request<Session>('/auth/login', { method: 'POST', body: { email: changedEmail, password: 'SmokeTest!2026' } });
    console.log('PASS account email change requires password and updates sign-in identity');

    await request('/auth/change-password', { method: 'POST', token: dByNewEmail.accessToken, body: { currentPassword: 'SmokeTest!2026', newPassword: 'SmokeTest!ChangedOnce2026' } });
    await request('/auth/me', { token: dByNewEmail.accessToken, expected: 401 });
    await request('/auth/refresh', { method: 'POST', expected: 401, body: { refreshToken: dByNewEmail.refreshToken } });
    const dAfterPasswordChange = await request<Session>('/auth/login', { method: 'POST', body: { email: changedEmail, password: 'SmokeTest!ChangedOnce2026' } });
    console.log('PASS password change revokes all previous sessions');

    await request('/auth/sign-out-all', { method: 'POST', token: dAfterPasswordChange.accessToken });
    await request('/auth/me', { token: dAfterPasswordChange.accessToken, expected: 401 });
    const dAfterSignOutAll = await request<Session>('/auth/login', { method: 'POST', body: { email: changedEmail, password: 'SmokeTest!ChangedOnce2026' } });
    console.log('PASS sign-out-all revokes the current and other sessions');

    const resetRequest = await request<{ ok: boolean; developmentToken?: string }>('/auth/password-reset/request', { method: 'POST', body: { email: changedEmail } });
    const unknownReset = await request<{ ok: boolean; developmentToken?: string }>('/auth/password-reset/request', { method: 'POST', body: { email: `missing-${stamp}@example.test` } });
    assert(unknownReset.ok === true && unknownReset.developmentToken === undefined, 'Unknown-email password reset did not return the neutral response.');
    if (resetRequest.developmentToken) {
      await request('/auth/password-reset/confirm', { method: 'POST', body: { token: resetRequest.developmentToken, password: 'SmokeTest!Changed2026' } });
      await request('/auth/me', { token: dAfterSignOutAll.accessToken, expected: 401 });
      await request('/auth/refresh', { method: 'POST', expected: 401, body: { refreshToken: dAfterSignOutAll.refreshToken } });
      const dChanged = await request<Session>('/auth/login', { method: 'POST', body: { email: changedEmail, password: 'SmokeTest!Changed2026' } });
      console.log('PASS password reset immediately revokes old access + refresh sessions');
      await request('/auth/account', { method: 'DELETE', token: dChanged.accessToken, expected: 204, body: { password: 'SmokeTest!Changed2026' } });
      await request('/auth/login', { method: 'POST', expected: 401, body: { email: changedEmail, password: 'SmokeTest!Changed2026' } });
      console.log('PASS account deletion revokes login and removes the account from active use');
    } else {
      await request('/auth/account', { method: 'DELETE', token: dAfterSignOutAll.accessToken, expected: 204, body: { password: 'SmokeTest!ChangedOnce2026' } });
      await request('/auth/login', { method: 'POST', expected: 401, body: { email: changedEmail, password: 'SmokeTest!ChangedOnce2026' } });
      console.log('PASS account deletion (password reset delivery token hidden outside local development)');
    }

    await request('/workspace/leave', { method: 'POST', token: b.accessToken });
    assert((await request<Json>('/workspace', { token: b.accessToken })).couple === null, 'Leaving a couple did not unlink the account.');
    console.log('PASS leave-couple lifecycle');
    await request('/workspace', { method: 'DELETE', token: c.accessToken, expected: 204 });
    assert((await request<Json>('/workspace', { token: c.accessToken })).couple === null, 'Deleting a couple space did not clear owner membership.');
    console.log('PASS owner delete-couple lifecycle');

    console.log('\nTogetherly API smoke test passed all checks.');
  } finally {
    // Remove only accounts created by this run. FK cascades clean their couples,
    // sessions, content, notifications and other smoke-test data.
    try {
      if (createdCoupleIds.length) await pool.query('DELETE FROM couples WHERE id = ANY($1::uuid[])', [createdCoupleIds]);
      await pool.query('DELETE FROM users WHERE email = ANY($1::text[]) OR id = ANY($2::uuid[])', [Object.values(emails), createdUserIds]);
    } catch (error) {
      console.warn('Smoke cleanup warning:', error);
    }
    await app.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('\nSMOKE TEST FAILED');
  console.error(error);
  process.exitCode = 1;
});
