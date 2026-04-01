import Fastify from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './middleware/error-handler';
import { videoRoutes } from './routes/videos';
import { userRoutes } from './routes/users';
import { highlightRoutes } from './routes/highlights';
import { reelRoutes } from './routes/reels';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: true, // Allow all origins in dev
    credentials: true,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  app.register(videoRoutes, { prefix: '/api/videos' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(highlightRoutes, { prefix: '/api/highlights' });
  app.register(reelRoutes, { prefix: '/api/reels' });

  return app;
}
