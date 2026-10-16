import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import { experienceFixture } from './testing/experienceFixture.js';

// Run with: cd server && node --import tsx src/photoMigrationSmoke.ts
// This fixture uses isolated in-memory PostgreSQL, never the user's database.
const f = await experienceFixture();
const app = Fastify({ logger: false });
const { registerPhotoRoutes } = await import('./routes/photos.js');
await registerPhotoRoutes(app, { broadcastCouple() {} } as unknown as import('./realtime/hub.js').RealtimeHub);
async function call(user: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, status = 200, payload?: object) {
  const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${f.tokens[user]}` } });
  assert.equal(response.statusCode, status, `${method} ${url}: ${response.body}`);
  return status === 204 ? null : response.json();
}
try {
  const memory = '44444444-4444-4444-8444-444444444444';
  const album = '55555555-5555-4555-8555-555555555555';
  await f.db.query("INSERT INTO memories(id,couple_id,creator_id,title,memory_date,photo_url) VALUES($1,$2,$3,'A day outside','2026-08-02','https://example.invalid/photo.jpg')", [memory, f.couple, f.userA]);
  await f.db.query("INSERT INTO memory_albums(id,couple_id,creator_id,title) VALUES($1,$2,$3,'Nature Spots')", [album, f.couple, f.userA]);
  await f.db.query('INSERT INTO memory_album_items(album_id,memory_id,added_by) VALUES($1,$2,$3)', [album, memory, f.userA]);
  await f.db.exec(await readFile(new URL('../migrations/019_memory_photo_integration.sql', import.meta.url), 'utf8'));
  const listed = await call(f.userA, 'GET', '/photo-albums');
  const imported = listed.albums.find((a: { title: string }) => a.title === 'Nature Spots');
  assert.ok(imported);
  assert.equal(imported.photo_count, 1);
  const detail = await call(f.userA, 'GET', `/photo-albums/${imported.id}`);
  assert.equal(detail.photos.length, 1);
  const photo = detail.photos[0];
  assert.equal((await call(f.userB, 'GET', `/photos/${photo.id}`)).photo.id, photo.id);
  await call(f.userA, 'PATCH', `/photo-albums/${imported.id}`, 200, { title: 'Renamed' });
  await call(f.userA, 'PATCH', `/photos/${photo.id}`, 200, { caption: 'Kept safely' });
  await call(f.userC, 'GET', `/photo-albums/${imported.id}`, 404);
  await call(f.userC, 'GET', `/photos/${photo.id}`, 404);
  await call(f.userC, 'PATCH', `/photo-albums/${imported.id}`, 404, { title: 'Forbidden' });
  await call(f.userC, 'POST', `/photo-albums/${imported.id}/photos`, 404, { photoId: photo.id });
  await call(f.userA, 'GET', '/photo-albums/not-a-uuid', 400);
  await call(f.userA, 'GET', '/photos/not-a-uuid', 400);
  await call(f.userA, 'DELETE', `/photo-albums/${imported.id}/photos/${photo.id}`, 204);
  await call(f.userA, 'POST', `/photo-albums/${imported.id}/photos`, 201, { photoId: photo.id });
  await call(f.userA, 'DELETE', `/photo-albums/${imported.id}`, 204);
  assert.equal((await call(f.userA, 'GET', `/photos/${photo.id}`)).photo.caption, 'Kept safely');
  await call(f.userA, 'DELETE', `/photos/${photo.id}`, 204);
  console.log('PASS imported album/photo access, edits, membership changes, deletion, malformed IDs and couple isolation');
} finally {
  await app.close();
  await f.app.close();
  await f.db.close();
  await f.pool.end();
}
