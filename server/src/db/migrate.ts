import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, '../../migrations');

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const alreadyApplied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (alreadyApplied.rowCount) continue;

    const sql = await readFile(join(migrationsDirectory, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Keep the CLI useful while also allowing the API to run a safe dev preflight.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations()
  .then(async () => {
    console.log('Database migrations are up to date.');
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
}
