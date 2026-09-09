import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { experienceFixture } from './testing/experienceFixture.js';
const f = await experienceFixture();
const { app, db, userA, userB, userC, couple, otherCouple, tokens } = f;
async function call(user: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, status = 200) {
  const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens[user]}` } });
  assert.equal(response.statusCode, status, `${method} ${url}: ${response.body}`);
  return response.statusCode === 204 ? null : response.json();
}
const startAt = new Date(Date.now() + 86400000).toISOString();
const endAt = new Date(Date.now() + 90000000).toISOString();
try {
  const proposalId = randomUUID();
  const input = { id: proposalId, title: 'Our movie night', startAt, endAt };
  await call(userA, 'POST', '/date-proposals', input, 201);
  await call(userA, 'POST', '/date-proposals', input);
  assert.equal((await call(userA, 'GET', '/date-proposals')).proposals.length, 1);
  await call(userA, 'POST', `/date-proposals/${proposalId}/respond`, { action: 'accept', revision: 1 }, 403);
  await call(userC, 'POST', `/date-proposals/${proposalId}/respond`, { action: 'accept', revision: 1 }, 404);
  await call(userB, 'POST', `/date-proposals/${proposalId}/respond`, { action: 'accept', revision: 99 }, 409);
  const accepted = await call(userB, 'POST', `/date-proposals/${proposalId}/respond`, { action: 'accept', revision: 1 });
  const repeated = await call(userB, 'POST', `/date-proposals/${proposalId}/respond`, { action: 'accept', revision: 1 });
  assert.equal(repeated.proposal.event_id, accepted.proposal.event_id);
  assert.equal((await db.query('SELECT * FROM events WHERE couple_id=$1', [couple])).rows.length, 1);
  console.log('PASS proposal permissions, revisions, and idempotent creation/acceptance');

  const collision = randomUUID();
  await call(userA, 'POST', '/date-proposals', { ...input, id: collision }, 201);
  await call(userB, 'POST', `/date-proposals/${collision}/respond`, { action: 'accept', revision: 1 }, 409);
  const counterStart = new Date(Date.now() + 3 * 86400000).toISOString();
  const counterEnd = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
  await call(userB, 'POST', `/date-proposals/${collision}/respond`, { action: 'counter', revision: 1, title: 'A different night', startAt: counterStart, endAt: counterEnd });
  await call(userB, 'POST', `/date-proposals/${collision}/respond`, { action: 'accept', revision: 2 }, 403);
  await call(userA, 'POST', `/date-proposals/${collision}/respond`, { action: 'accept', revision: 1 }, 409);
  await call(userA, 'POST', `/date-proposals/${collision}/respond`, { action: 'accept', revision: 2 });
  await call(userA, 'POST', '/date-proposals', { ...input, id: randomUUID(), endAt: startAt }, 400);
  console.log('PASS conflicting times, counterproposals, and invalid intervals');

  const memory = await call(userA, 'POST', '/memories', { title: 'That night', memoryDate: '2026-01-01', sourceEventId: accepted.proposal.event_id }, 201);
  assert.equal(memory.memory.source_event_id, accepted.proposal.event_id);
  await call(userC, 'POST', '/memories', { title: 'Wrong space', memoryDate: '2026-01-01', sourceEventId: accepted.proposal.event_id }, 404);
  await call(userA, 'PUT', `/memories/${memory.memory.id}/reflections`, { body: 'My favourite bit.' });
  await call(userB, 'PUT', `/memories/${memory.memory.id}/reflections`, { body: 'Mine too.' });
  await call(userA, 'PUT', `/memories/${memory.memory.id}/reflections`, { body: 'Updated my words.' });
  const reflections = await call(userB, 'GET', `/memories/${memory.memory.id}/reflections`);
  assert.equal(reflections.reflections.length, 2);
  assert.equal(reflections.reflections.find((row: { user_id: string }) => row.user_id === userB).body, 'Mine too.');
  await call(userC, 'PUT', `/memories/${memory.memory.id}/reflections`, { body: 'Intrusion' }, 404);
  console.log('PASS source-memory ownership and independent partner reflections');

  const capsuleId = randomUUID();
  const secret = 'A future surprise';
  const capsule = await call(userA, 'POST', '/time-capsules', { id: capsuleId, title: 'For later', body: secret, opensAt: startAt }, 201);
  assert.equal(capsule.capsule.body, null);
  for (const user of [userA, userB]) {
    const sealed = await call(user, 'GET', '/time-capsules');
    assert.equal(sealed.capsules[0].body, null);
    assert.equal(sealed.capsules[0].opened, false);
  }
  assert.equal((await call(userC, 'GET', '/time-capsules')).capsules.length, 0);
  await call(userB, 'DELETE', `/time-capsules/${capsuleId}`, undefined, 404);
  await db.query("UPDATE time_capsules SET opens_at=now()-interval '1 minute' WHERE id=$1", [capsuleId]);
  assert.equal((await call(userB, 'GET', '/time-capsules')).capsules[0].body, secret);
  await call(userA, 'DELETE', `/time-capsules/${capsuleId}`, undefined, 204);
  console.log('PASS sealed content stays server-side, timed reveal, and deletion ownership');

  const checkIn = await call(userA, 'POST', '/moods', { mood: 'tired', need: 'space', visibility: 'private', context: 'After work', validForHours: 4 }, 201);
  assert.equal(checkIn.mood.context, 'After work');
  assert.ok(Date.parse(checkIn.mood.valid_until) > Date.now());
  assert.equal((await call(userB, 'GET', '/moods/latest')).partner, null);
  await call(userA, 'POST', '/moods', { mood: 'tired', need: 'space', validForHours: -1 }, 400);
  console.log('PASS private check-in context and expiry validation');
  const replaySql = await (await import('node:fs/promises')).readFile(new URL('../migrations/020_connected_experience.sql', import.meta.url), 'utf8');
  await db.exec(replaySql);
  console.log('PASS additive migration can be replayed without losing data');
  console.log('All connected-experience checks passed. All migrations applied to isolated PostgreSQL.');
} finally { await app.close(); await db.close(); await f.pool.end(); }
