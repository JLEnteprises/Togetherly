import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { experienceFixture } from './testing/experienceFixture.js';
const f = await experienceFixture();
const app = Fastify({ logger: false });
const { registerCoreFeatureRoutes } = await import('./routes/coreFeatures.js');
const { registerTogetherRoutes } = await import('./routes/together.js');
const { registerOfflineRoutes } = await import('./routes/offline.js');
const realtime = { broadcastCouple() {} } as unknown as import('./realtime/hub.js').RealtimeHub;
await registerCoreFeatureRoutes(app, realtime); await registerTogetherRoutes(app, realtime); await registerOfflineRoutes(app);
async function send(payload: object, status = 200, user = f.userA) {
  const r = await app.inject({ method: 'POST', url: '/sync/mutation', payload, headers: { authorization: `Bearer ${f.tokens[user]}` } });
  assert.equal(r.statusCode, status, r.body); return r.json();
}
try {
  const op = { id: 'offline-test-123', coupleId: f.couple, method: 'POST', path: '/tasks', body: { title: 'Offline task', subtasks: [{title:'Step one'}] } };
  const first = await send(op); const retry = await send(op);
  assert.equal(first.result.task.id, retry.result.task.id);
  assert.equal((await f.db.query('SELECT * FROM tasks')).rows.length, 1);
  assert.equal(first.result.task.subtasks.length, 1);
  await send({...op, body: {title:'Different'}},409);
  await send({...op,id:'other-couple-123'},403,f.userC);
  const done = {id:'offline-done-123',coupleId:f.couple,method:'PATCH',path:`/tasks/${first.result.task.id}`,body:{status:'completed',updatedAt:first.result.task.updated_at}};
  await send(done); await send(done);
  await send({...done,id:'stale-version-123',body:{title:'Overwrites partner',updatedAt:first.result.task.updated_at}},409);
  await send({...op,id:'bad-content-123',body:{title:''}},400);
  assert.equal((await f.db.query("SELECT * FROM offline_receipts WHERE operation_id='bad-content-123'")).rows.length,0);
  const mood = {id:'offline-mood-123',coupleId:f.couple,method:'POST',path:'/moods',body:{mood:'good',need:'nothing',visibility:'private'}};
  await send(mood); await send(mood);
  assert.equal((await f.db.query('SELECT * FROM moods')).rows.length,1);
  await f.db.exec(`CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation_id='rollback-operation' THEN RAISE EXCEPTION 'test receipt failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_receipt BEFORE INSERT ON offline_receipts FOR EACH ROW EXECUTE FUNCTION fail_receipt();`);
  await send({...op,id:'rollback-operation',body:{title:'Must roll back'}},500);
  assert.equal((await f.db.query("SELECT * FROM tasks WHERE title='Must roll back'")).rows.length,0);
  assert.equal((await f.db.query("SELECT * FROM notifications WHERE body='Must roll back'")).rows.length,0);
  const oldTime = new Date(Date.now()-86400000).toISOString();
  const oldMood = await send({...mood,id:'expired-mood-123',body:{...mood.body,recordedAt:oldTime,validForHours:1}});
  assert.ok(Date.parse(oldMood.result.mood.valid_until)<Date.now());
  console.log('PASS atomic replay, duplicate protection, steps, completion, conflict and membership rejection, private mood replay');
} finally { await app.close(); await f.app.close(); await f.db.close(); await f.pool.end(); }
