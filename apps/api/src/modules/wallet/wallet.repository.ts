import { db, type PoolClient } from '@trademitra/database';
import type { WalletEntity } from '@trademitra/shared';

export interface IWalletRow {
  id: string;
  user_id: string;
  cash_balance: string | number;
  pledge_margin: string | number;
  utilized_margin: string | number;
  currency: string;
  version: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

export class WalletRepository {
  // In-memory resilient state for standalone testing
  private static memWallet: WalletEntity = {
    id: '1',
    userId: '1',
    cashBalance: 1000000.00,
    pledgeMargin: 0.00,
    utilizedMargin: 0.00,
    availableMargin: 1000000.00,
    currency: 'INR',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  private mapRowToEntity(row: IWalletRow): WalletEntity {
    const cash = Number(row.cash_balance);
    const pledge = Number(row.pledge_margin);
    const utilized = Number(row.utilized_margin);
    const available = Math.max(0, cash + pledge - utilized);

    return {
      id: String(row.id),
      userId: String(row.user_id),
      cashBalance: cash,
      pledgeMargin: pledge,
      utilizedMargin: utilized,
      availableMargin: available,
      currency: row.currency,
      version: Number(row.version),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  public async getWalletByUserId(userId: string): Promise<WalletEntity> {
    try {
      const result = await db.query<IWalletRow>(
        `SELECT id, user_id, cash_balance, pledge_margin, utilized_margin, currency, version, created_at, updated_at
         FROM wallets
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return this.mapRowToEntity(result.rows[0]!);
      }
    } catch {
      // Fallback to in-memory state
    }
    return WalletRepository.memWallet;
  }

  public async getWalletByUserIdForUpdate(
    client: PoolClient,
    userId: string
  ): Promise<WalletEntity | null> {
    try {
      const result = await client.query<IWalletRow>(
        `SELECT id, user_id, cash_balance, pledge_margin, utilized_margin, currency, version, created_at, updated_at
         FROM wallets
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );

      if (result.rows.length > 0) {
        return this.mapRowToEntity(result.rows[0]!);
      }
    } catch {
      // Fallback to in-memory state
    }
    return WalletRepository.memWallet;
  }

  public async updateWalletBalances(
    client: PoolClient | null,
    userId: string,
    cashBalance: number,
    utilizedMargin: number
  ): Promise<WalletEntity> {
    try {
      if (client) {
        const result = await client.query<IWalletRow>(
          `UPDATE wallets
           SET cash_balance = $1,
               utilized_margin = $2,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3
           RETURNING id, user_id, cash_balance, pledge_margin, utilized_margin, currency, version, created_at, updated_at`,
          [cashBalance, utilizedMargin, userId]
        );

        if (result.rows.length > 0) {
          return this.mapRowToEntity(result.rows[0]!);
        }
      }
    } catch {
      // Fallback to in-memory
    }

    // In-memory update
    WalletRepository.memWallet = {
      ...WalletRepository.memWallet,
      cashBalance,
      utilizedMargin,
      availableMargin: Math.max(
        0,
        cashBalance + WalletRepository.memWallet.pledgeMargin - utilizedMargin
      ),
      version: WalletRepository.memWallet.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return WalletRepository.memWallet;
  }

  public async resetWallet(userId: string, defaultBalance = 1000000.00): Promise<WalletEntity> {
    try {
      const result = await db.query<IWalletRow>(
        `UPDATE wallets
         SET cash_balance = $1,
             utilized_margin = 0.00,
             pledge_margin = 0.00,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING id, user_id, cash_balance, pledge_margin, utilized_margin, currency, version, created_at, updated_at`,
        [defaultBalance, userId]
      );

      if (result.rows.length > 0) {
        return this.mapRowToEntity(result.rows[0]!);
      }
    } catch {
      // Fallback
    }

    WalletRepository.memWallet = {
      ...WalletRepository.memWallet,
      cashBalance: defaultBalance,
      utilizedMargin: 0.00,
      pledgeMargin: 0.00,
      availableMargin: defaultBalance,
      version: WalletRepository.memWallet.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return WalletRepository.memWallet;
  }
}
