import type { Request, Response } from 'express';
import { WalletService } from './wallet.service.js';

export class WalletController {
  private readonly service: WalletService;

  constructor(service = new WalletService()) {
    this.service = service;
  }

  public async getWallet(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const wallet = await this.service.getWallet(userId);

    res.status(200).json({
      success: true,
      data: wallet,
    });
  }

  public async resetWallet(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const wallet = await this.service.resetWallet(userId);

    res.status(200).json({
      success: true,
      message: 'Wallet margin successfully reset to ₹10,00,000.',
      data: wallet,
    });
  }
}
