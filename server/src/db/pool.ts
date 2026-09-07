import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;

// PostgreSQL DATE has no timezone. Keep it as YYYY-MM-DD text instead of
// converting it to a JavaScript Date, which can shift calendar dates by the
// server timezone and makes partial-update comparisons unreliable.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
