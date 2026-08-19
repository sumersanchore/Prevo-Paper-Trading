import { WalletRepository } from './wallet.repository.js';
import { PositionsRepository } from '../positions/positions.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import type { WalletEntity, WalletTransactionEntity } from '@trademitra/shared';

export class WalletService {
  private readonly repository: WalletRepository;
  private readonly positionsRepo: PositionsRepository;
  private readonly ordersRepo: OrdersRepository;

  constructor(
    repository = new WalletRepository(),
    positionsRepo = new PositionsRepository(),
    ordersRepo = new OrdersRepository()
  ) {
    this.repository = repository;
    this.positionsRepo = positionsRepo;
    this.ordersRepo = ordersRepo;
  }

  public async getWallet(userId: string): Promise<WalletEntity> {
    const rawWallet = await this.repository.getWalletByUserId(userId);

    // Dynamically compute exact live utilized margin from active open positions & pending orders
    try {
      const positions = await this.positionsRepo.getPositionsByUserId(userId);
      let calculatedUtilized = 0;

      for (const pos of positions) {
        if (pos.status === 'OPEN' && pos.netQuantity !== 0) {
          if (pos.netQuantity > 0) {
            // Long position: capital deployed = netQuantity * averageBuyPrice
            const avg = pos.averageBuyPrice || 0;
            calculatedUtilized += pos.netQuantity * avg;
          } else {
            // Short position: SPAN margin = lots * 115000
            const lotSize = (pos as any).lotSize || 25;
            const lots = Math.max(1, Math.round(Math.abs(pos.netQuantity) / lotSize));
            calculatedUtilized += lots * 115000;
          }
        }
      }

      // Also check pending fresh opening orders
      const pendingOrders = await this.ordersRepo.getOrdersByUserId(userId, 'PENDING');
      for (const ord of pendingOrders) {
        const matchingPos = positions.find(
          (p) => p.contractId === ord.contractId && p.productType === ord.productType
        );
        const isClosing =
          (ord.transactionType === 'SELL' && (matchingPos?.netQuantity ?? 0) > 0) ||
          (ord.transactionType === 'BUY' && (matchingPos?.netQuantity ?? 0) < 0);
        if (!isClosing) {
          if (ord.transactionType === 'BUY') {
            calculatedUtilized += ord.quantity * (ord.price || ord.triggerPrice || 0);
          } else {
            const lots = Math.max(1, Math.round(ord.quantity / 25));
            calculatedUtilized += lots * 115000;
          }
        }
      }

      calculatedUtilized = Number(calculatedUtilized.toFixed(2));

      // Calculate accurate available margin: Total Cash + Pledge - Active Utilized
      const cash = Number(rawWallet.cashBalance.toFixed(2));
      const available = Math.max(0, Number((cash + rawWallet.pledgeMargin - calculatedUtilized).toFixed(2)));

      return {
        ...rawWallet,
        utilizedMargin: calculatedUtilized,
        availableMargin: available,
      };
    } catch {
      return rawWallet;
    }
  }

  public async resetWallet(userId: string): Promise<WalletEntity> {
    const wallet = await this.repository.resetWallet(userId, 1000000.00);
    // Record the reset as a CREDIT transaction in the ledger
    await this.repository.recordTransaction(
      null,
      userId,
      'RESET',
      'CREDIT',
      1000000.00,
      1000000.00,
      'Paper trading wallet reset to ₹10,00,000'
    );
    return wallet;
  }

  public async getTransactions(userId: string): Promise<WalletTransactionEntity[]> {
    return this.repository.getTransactions(userId, 50);
  }
}
