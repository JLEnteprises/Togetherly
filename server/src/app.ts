import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWorkspaceRoutes } from './routes/workspace.js';
import { registerSharedItemRoutes } from './routes/sharedItems.js';
import { registerCoreFeatureRoutes } from './routes/coreFeatures.js';
import { registerPlanningRoutes } from './routes/planning.js';
import { registerTogetherRoutes } from './routes/together.js';
import { registerMemoryRoutes } from './routes/memories.js';
import { registerPreferenceRoutes } from './routes/preferences.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerAvailabilityRoutes } from './routes/availability.js';
import { registerGameRoutes } from './routes/games.js';
import { registerLocationRoutes } from './routes/location.js';
import { RealtimeHub } from './realtime/hub.js';

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 8_000_000 });
  await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'] });
  const realtime = new RealtimeHub(app.server);

  app.get('/health', async () => ({ ok: true }));
  await registerAuthRoutes(app, realtime);
  await registerWorkspaceRoutes(app, realtime);
  await registerSharedItemRoutes(app, realtime);
  await registerCoreFeatureRoutes(app, realtime);
  await registerPlanningRoutes(app, realtime);
  await registerTogetherRoutes(app, realtime);
  await registerMemoryRoutes(app, realtime);
  await registerPreferenceRoutes(app, realtime);
  await registerNotificationRoutes(app);
  await registerAvailabilityRoutes(app, realtime);
  await registerGameRoutes(app, realtime);
  await registerLocationRoutes(app, realtime);
  return app;
}
