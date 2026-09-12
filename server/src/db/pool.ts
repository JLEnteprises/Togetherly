import pg from 'pg';
import { requestTransaction } from './requestTransaction.js';
import { config } from '../config.js';

const { Pool, types } = pg;

// PostgreSQL DATE has no timezone. Keep it as YYYY-MM-DD text instead of
// converting it to a JavaScript Date, which can shift calendar dates by the
// server timezone and makes partial-update comparisons unreliable.
types.setTypeParser(1082, (value) => value);

const basePool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Sync replays and their receipt share one transaction, including existing routes
// that acquire a client and use BEGIN/COMMIT internally.
export const pool = new Proxy(basePool, {
  get(target, key) {
    const scope = requestTransaction.getStore();
    if (scope && key === 'query') return scope.client.query.bind(scope.client);
    if (scope && key === 'connect') return async () => {
      let savepoint = false;
      return {
        async query(sql: string, values?: unknown[]) {
          if (sql === 'BEGIN') { savepoint = true; return scope.client.query('SAVEPOINT sync_route'); }
          if (sql === 'COMMIT' && savepoint) { savepoint = false; return scope.client.query('RELEASE SAVEPOINT sync_route'); }
          if (sql === 'ROLLBACK' && savepoint) { savepoint = false; return scope.client.query('ROLLBACK TO SAVEPOINT sync_route'); }
          return scope.client.query(sql, values);
        },
        release() {},
      };
    };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
