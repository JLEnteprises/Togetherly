import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { startReminderScheduler } from './reminders/scheduler.js';

const app = await buildApp();
const stopReminders = startReminderScheduler();
app.addHook('onClose', async () => { stopReminders(); });

try {
  await pool.query('SELECT 1');
  await app.listen({ host: config.host, port: config.port });
  console.log(`Togetherly API listening on http://${config.host}:${config.port}`);
} catch (error) {
  stopReminders();
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
