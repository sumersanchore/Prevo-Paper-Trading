import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  rateLimits: {
    globalWindowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? '900000', 10), // 15 mins
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX ?? '1000', 10),
    orderWindowMs: parseInt(process.env.RATE_LIMIT_ORDER_WINDOW_MS ?? '5000', 10), // 5 secs
    orderMax: parseInt(process.env.RATE_LIMIT_ORDER_MAX ?? '50', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'trademitra_super_secret_jwt_key_2026_enterprise',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  mcp: {
    feedEndpoint: process.env.MCP_FEED_ENDPOINT ?? 'http://localhost:8000/feed',
    reconnectIntervalMs: parseInt(process.env.MCP_FEED_RECONNECT_INTERVAL_MS ?? '3000', 10),
  },
};
