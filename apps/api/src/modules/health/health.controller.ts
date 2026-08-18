import type { Request, Response } from 'express';
import { db } from '@trademitra/database';

export class HealthController {
  public async getHealth(_req: Request, res: Response): Promise<void> {
    const dbHealth = await db.healthCheck().catch(() => ({
      status: 'unhealthy' as const,
      latencyMs: -1,
      poolStats: db.getPoolStats(),
      timestamp: new Date().toISOString(),
    }));

    res.status(200).json({
      success: true,
      service: 'TradeMitra API',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbHealth,
    });
  }
}
