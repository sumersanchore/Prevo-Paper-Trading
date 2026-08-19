import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config/env.config.js';
import { swaggerSpec } from '../config/swagger.config.js';
import { globalRateLimiter } from './middlewares/rate-limit.middleware.js';
import { errorHandler } from '../core/middlewares/error.middleware.js';
import { mainRouter } from './router.js';

export function createServer(): Application {
  const app = express();

  // Security & Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global Rate Limiter
  app.use(globalRateLimiter);

  // Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Health check routes
  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({
      status: 'healthy',
      platform: 'PREVO',
      timestamp: new Date().toISOString(),
    });
  });

  // Domain API Routes (Support both /api/v1 and /v1 for Vercel Serverless compatibility)
  app.use([config.apiPrefix, '/v1'], mainRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
