import type { Request, Response } from 'express';
import { PositionsService } from './positions.service.js';

export class PositionsController {
  private readonly service: PositionsService;

  constructor(service = new PositionsService()) {
    this.service = service;
  }

  public async getPositions(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const summary = await this.service.getPositionsSummary(userId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  }
}
