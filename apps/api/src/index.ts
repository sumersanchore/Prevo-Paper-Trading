import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from './http/server.js';
import { config } from './config/env.config.js';
import { logger } from './core/logger.js';
import { SocketStreamHandler } from './sockets/stream.handler.js';
import { McpFeedProvider } from './providers/mcp.provider.js';

async function bootstrap() {
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

void bootstrap();
