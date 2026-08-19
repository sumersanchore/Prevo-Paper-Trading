import rateLimit from 'express-rate-limit';
import { config } from '../../config/env.config.js';

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimits.globalWindowMs,
  max: config.env === 'development' ? 50000 : config.rateLimits.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'development',
  message: {
    success: false,
    error: {
      message: 'Global rate limit exceeded. Please try again in a moment.',
    },
  },
});

export const orderPlacementRateLimiter = rateLimit({
  windowMs: config.rateLimits.orderWindowMs,
  max: config.env === 'development' ? 500 : config.rateLimits.orderMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'development',
  message: {
    success: false,
    error: {
      message: 'Order rate limit exceeded. Please wait a moment before placing another order.',
    },
  },
});
