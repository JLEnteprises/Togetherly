import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { startReminderScheduler } from './reminders/scheduler.js';
import { runMigrations } from './db/migrate.js';

const app = await buildApp();
const stopReminders = startReminderScheduler();
app.addHook('onClose', async () => { stopReminders(); });

try {
  await pool.query('SELECT 1');
  // Development servers are frequently started without the separate migration
  // command. Apply additive migrations before accepting requests so the API and
  // database cannot drift (production can opt in with AUTO_MIGRATE=true).
  if (!config.isProduction || process.env.AUTO_MIGRATE === 'true') {
    await runMigrations();
  }
  await app.listen({ host: config.host, port: config.port });
  console.log(`Togetherly API listening on http://${config.host}:${config.port}`);
} catch (error) {
  stopReminders();
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
