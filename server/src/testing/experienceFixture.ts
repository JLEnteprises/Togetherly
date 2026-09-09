import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';

// In-memory PostgreSQL only. No developer or production database is contacted.
export async function experienceFixture() {
  process.env.JWT_SECRET = 'togetherly-isolated-fixture-secret-00000000';
  process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:1/unused';
  process.env.NODE_ENV = 'test';
  const db = new PGlite();
  const directory = fileURLToPath(new URL('../../migrations/', import.meta.url));
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`${directory}/${name}`, 'utf8'));
  }
  const { pool } = await import('../db/pool.js');
  const query = async (sql: string, values?: unknown[]) => {
    const result = await db.query(sql, values);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  pool.query = query as unknown as typeof pool.query;
  pool.connect = (async () => ({ query, release() {} })) as unknown as typeof pool.connect;
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const userC = '33333333-3333-4333-8333-333333333333';
  const couple = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherCouple = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  for (const [id, name, zone] of [[userA, 'Alex', 'Australia/Brisbane'], [userB, 'Jordan', 'America/Chicago'], [userC, 'Casey', 'UTC']]) {
    await db.query(`INSERT INTO users(id,email,password_hash,display_name,timezone,onboarding_complete) VALUES($1,$2,'not-a-password',$3,$4,true)`, [id, `${name}@example.invalid`, name, zone]);
  }
  await db.query('INSERT INTO couples(id,relationship_start_date,long_distance_enabled) VALUES($1,\'2025-01-01\',true),($2,NULL,false)', [couple, otherCouple]);
  await db.query('INSERT INTO couple_members(couple_id,user_id) VALUES($1,$2),($1,$3),($4,$5)', [couple, userA, userB, otherCouple, userC]);
  const { issueAccessToken } = await import('../auth/tokens.js');
  const tokens = Object.fromEntries([userA, userB, userC].map((id) => [id, issueAccessToken(id, 1).token]));
  const app = Fastify({ logger: false, bodyLimit: 8000000 });
  const { registerExperienceRoutes } = await import('../routes/experience.js');
  const { registerMemoryRoutes } = await import('../routes/memories.js');
  const { registerTogetherRoutes } = await import('../routes/together.js');
  const realtime = { broadcastCouple() {} } as unknown as import('../realtime/hub.js').RealtimeHub;
  await registerExperienceRoutes(app, realtime);
  await registerMemoryRoutes(app, realtime);
  await registerTogetherRoutes(app, realtime);
  await app.ready();
  return { app, db, pool, userA, userB, userC, couple, otherCouple, tokens, query };
}
