import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { recipesRoutes } from './routes/recipes.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false
  });

  // Enable CORS for mobile app & local dev
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register recipe API routes
  app.register(recipesRoutes, { prefix: '/api/v1/recipes' });

  return app;
}
