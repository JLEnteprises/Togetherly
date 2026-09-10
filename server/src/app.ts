import { registerExperienceRoutes } from './routes/experience.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWorkspaceRoutes } from './routes/workspace.js';
import { registerSharedItemRoutes } from './routes/sharedItems.js';
import { registerCoreFeatureRoutes } from './routes/coreFeatures.js';
import { registerPlanningRoutes } from './routes/planning.js';
import { registerTogetherRoutes } from './routes/together.js';
import { registerMemoryRoutes } from './routes/memories.js';
import { registerPhotoRoutes } from './routes/photos.js';
import { registerPreferenceRoutes } from './routes/preferences.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerAvailabilityRoutes } from './routes/availability.js';
import { registerGameRoutes } from './routes/games.js';
import { registerLocationRoutes } from './routes/location.js';
import { registerWatchRoutes } from './routes/watch.js';
import { RealtimeHub } from './realtime/hub.js';
import { config } from './config.js';
import { pool } from './db/pool.js';


type RateBucket = { count: number; resetAt: number };
const authRateBuckets = new Map<string, RateBucket>();
const AUTH_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'POST /auth/register': { max: 5, windowMs: 15 * 60_000 },
  'POST /auth/login': { max: 12, windowMs: 15 * 60_000 },
  'POST /auth/refresh': { max: 60, windowMs: 15 * 60_000 },
  'POST /auth/password-reset/request': { max: 5, windowMs: 30 * 60_000 },
  'POST /auth/password-reset/confirm': { max: 10, windowMs: 30 * 60_000 },
};

function cleanupRateBuckets(now: number) {
  if (authRateBuckets.size < 1000) return;
  for (const [key, value] of authRateBuckets) if (value.resetAt <= now) authRateBuckets.delete(key);
}

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 8_000_000, trustProxy: config.trustProxy });
  const corsOrigin = config.isProduction ? (config.corsOrigins.length ? config.corsOrigins : false) : true;
  await app.register(cors, { origin: corsOrigin, methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'] });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    if (request.protocol === 'https') reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (config.requireHttps && request.protocol !== 'https' && request.url !== '/health') {
      return reply.code(426).send({ error: 'HTTPS is required.' });
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    const routeKey = `${request.method} ${request.url.split('?')[0]}`;
    const limit = AUTH_LIMITS[routeKey];
    if (!limit) return;
    const now = Date.now();
    cleanupRateBuckets(now);
    const key = `${routeKey}:${request.ip}`;
    const current = authRateBuckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + limit.windowMs } : current;
    bucket.count += 1;
    authRateBuckets.set(key, bucket);
    reply.header('RateLimit-Limit', String(limit.max));
    reply.header('RateLimit-Remaining', String(Math.max(0, limit.max - bucket.count)));
    reply.header('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > limit.max) {
      reply.header('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return reply.code(429).send({ error: 'Too many attempts. Try again later.' });
    }
  });
  const realtime = new RealtimeHub(app.server);

  app.get('/health', async () => {
    try {
      const result = await pool.query(`
        SELECT
          to_regclass('public.date_proposals') IS NOT NULL AS date_plans,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moods' AND column_name='context') AS mood_context
      `);
      const schema = result.rows[0] as { date_plans: boolean; mood_context: boolean };
      const ready = schema.date_plans && schema.mood_context;
      return { ok: ready, database: true, schema: ready ? 'current' : 'out_of_date', checks: schema };
    } catch {
      return { ok: false, database: false, schema: 'unavailable' };
    }
  });
  await registerAuthRoutes(app, realtime);
  await registerWorkspaceRoutes(app, realtime);
  await registerSharedItemRoutes(app, realtime);
  await registerCoreFeatureRoutes(app, realtime);
  await registerPlanningRoutes(app, realtime);
  await registerTogetherRoutes(app, realtime);
  await registerMemoryRoutes(app, realtime);
  // H1_STANDALONE_PHOTOS_DATA_MODEL: first-class photo API is additive; legacy memory-photo routes stay registered unchanged.
  await registerPhotoRoutes(app, realtime);
  await registerPreferenceRoutes(app, realtime);
  await registerNotificationRoutes(app);
  await registerAvailabilityRoutes(app, realtime);
  await registerGameRoutes(app, realtime);
  await registerLocationRoutes(app, realtime);
  await registerWatchRoutes(app, realtime);
  await registerExperienceRoutes(app, realtime);
  return app;
}
