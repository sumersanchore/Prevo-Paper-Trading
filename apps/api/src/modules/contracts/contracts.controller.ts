import type { Request, Response } from 'express';
import { ContractsService } from './contracts.service.js';

export class ContractsController {
  private readonly service: ContractsService;

  constructor(service = new ContractsService()) {
    this.service = service;
  }

  public async getOptionChain(req: Request, res: Response): Promise<void> {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const expiry = req.query.expiry as string | undefined;
    const chainData = await this.service.getOptionChain(symbol, expiry);

    res.status(200).json({
      success: true,
      data: chainData,
    });
  }

  public async getContracts(req: Request, res: Response): Promise<void> {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const contracts = await this.service.getContracts(symbol);

    res.status(200).json({
      success: true,
      data: contracts,
    });
  }
}
