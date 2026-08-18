import rateLimit from 'express-rate-limit';
import { config } from '../../config/env.config.js';

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimits.globalWindowMs,
  max: config.rateLimits.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Global rate limit exceeded. Max 100 requests per 15 minutes.',
    },
  },
});

export const orderPlacementRateLimiter = rateLimit({
  windowMs: config.rateLimits.orderWindowMs,
  max: config.rateLimits.orderMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Order rate limit exceeded. Max 3 order actions per 5 seconds.',
    },
  },
});
