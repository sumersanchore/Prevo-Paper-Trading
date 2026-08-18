import { WalletRepository } from './wallet.repository.js';
import type { WalletEntity } from '@trademitra/shared';

export class WalletService {
  private readonly repository: WalletRepository;

  constructor(repository = new WalletRepository()) {
    this.repository = repository;
  }

  public async getWallet(userId: string): Promise<WalletEntity> {
    return this.repository.getWalletByUserId(userId);
  }

  public async resetWallet(userId: string): Promise<WalletEntity> {
    return this.repository.resetWallet(userId, 1000000.00);
  }
}
