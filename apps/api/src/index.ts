import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { autoMigrateDatabase } from '@trademitra/database';
import { createServer } from './http/server.js';
import { config } from './config/env.config.js';
import { logger } from './core/logger.js';
import { SocketStreamHandler } from './sockets/stream.handler.js';
import { McpFeedProvider } from './providers/mcp.provider.js';

async function bootstrap() {
  // 1. Auto-create & verify production database tables on startup
  try {
    logger.info('📦 Verifying & auto-migrating database tables for production...');
    await autoMigrateDatabase();
    logger.info('✅ Production database tables verified and up to date.');
  } catch (dbErr: any) {
    logger.error(`❌ Database auto-migration warning: ${dbErr?.message || dbErr}`);
  }

  const app = createServer();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const socketHandler = new SocketStreamHandler(io);
  void socketHandler;
  const feedProvider = McpFeedProvider.getInstance();

  httpServer.listen(config.port, () => {
    logger.info(`=======================================================`);
    logger.info(`🚀 TradeMitra API Server successfully started!`);
    logger.info(`   Author: Sumer Kumar`);
    logger.info(`   Port: ${config.port}`);
    logger.info(`   API Endpoint: http://localhost:${config.port}${config.apiPrefix}`);
    logger.info(`   Swagger Docs: http://localhost:${config.port}/api-docs`);
    logger.info(`   Socket.io Stream: http://localhost:${config.port}`);
    logger.info(`=======================================================`);
  });

  // Graceful termination
  const shutdown = () => {
    logger.info('Shutting down API server and market feed...');
    feedProvider.stop();
    httpServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { createServer };

if (!process.env.VERCEL) {
  void bootstrap();
}
