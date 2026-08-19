import { db, type PoolClient } from '@trademitra/database';
import type { WalletEntity, WalletTransactionEntity, WalletTxnType, WalletTxnDirection } from '@trademitra/shared';

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

export interface IWalletTransactionRow {
  id: string;
  user_id: string;
  order_id: string | null;
  type: string;
  amount: string | number;
  direction: string;
  balance_after: string | number;
  description: string;
  created_at: Date | string;
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

  // In-memory transaction ledger (fallback when DB is unavailable)
  private static memTransactions: WalletTransactionEntity[] = [];

  private mapRowToEntity(row: IWalletRow): WalletEntity {
    let cash = Number(row.cash_balance);
    const pledge = Number(row.pledge_margin);
    const utilized = Number(row.utilized_margin);

    // Self-healing: If cash_balance was stored as free cash (i.e. cash < utilized due to legacy double-deduction),
    // restore cash to total capital (cash + utilized) so that availableMargin is correctly (total - utilized)
    if (utilized > 0 && cash < utilized && cash + utilized > 0) {
      cash = Number((cash + utilized).toFixed(2));
    }

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

  private mapTxnRowToEntity(row: IWalletTransactionRow): WalletTransactionEntity {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      orderId: row.order_id ? String(row.order_id) : undefined,
      type: row.type as WalletTxnType,
      amount: Number(row.amount),
      direction: row.direction as WalletTxnDirection,
      balanceAfter: Number(row.balance_after),
      description: row.description,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private selfHealMemWallet(): WalletEntity {
    if (
      WalletRepository.memWallet.utilizedMargin > 0 &&
      WalletRepository.memWallet.cashBalance < WalletRepository.memWallet.utilizedMargin
    ) {
      WalletRepository.memWallet.cashBalance = Number(
        (WalletRepository.memWallet.cashBalance + WalletRepository.memWallet.utilizedMargin).toFixed(2)
      );
    }
    WalletRepository.memWallet.availableMargin = Math.max(
      0,
      WalletRepository.memWallet.cashBalance +
        WalletRepository.memWallet.pledgeMargin -
        WalletRepository.memWallet.utilizedMargin
    );
    return WalletRepository.memWallet;
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
    return this.selfHealMemWallet();
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
    return this.selfHealMemWallet();
  }

  public async updateWalletBalances(
    client: PoolClient | null,
    userId: string,
    cashBalance: number,
    utilizedMargin: number
  ): Promise<WalletEntity> {
    const updateSql = `
      UPDATE wallets
      SET cash_balance    = $1,
          utilized_margin = $2,
          version         = version + 1,
          updated_at      = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING id, user_id, cash_balance, pledge_margin, utilized_margin, currency, version, created_at, updated_at`;

    const params = [cashBalance, utilizedMargin, userId];

    try {
      const result = client
        ? await client.query<IWalletRow>(updateSql, params)
        : await db.query<IWalletRow>(updateSql, params);

      if (result.rows.length > 0) {
        const entity = this.mapRowToEntity(result.rows[0]!);
        WalletRepository.memWallet = entity;
        return entity;
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

  /**
   * Record a wallet debit or credit transaction in the ledger.
   * Falls back to in-memory when the DB is unavailable (e.g. standalone mode).
   */
  public async recordTransaction(
    client: PoolClient | null,
    userId: string,
    type: WalletTxnType,
    direction: WalletTxnDirection,
    amount: number,
    balanceAfter: number,
    description: string,
    orderId?: string
  ): Promise<void> {
    const roundedAmount = Number(amount.toFixed(2));
    const roundedBalance = Number(balanceAfter.toFixed(2));

    try {
      const sql = `INSERT INTO wallet_transactions
           (user_id, order_id, type, amount, direction, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`;
      const params = [userId, orderId ?? null, type, roundedAmount, direction, roundedBalance, description];
      if (client) {
        await client.query(sql, params);
      } else {
        await db.query(sql, params);
      }
      return;
    } catch {
      // Table may not exist yet — fall back to in-memory ledger
    }

    // In-memory fallback
    const memTxn: WalletTransactionEntity = {
      id: String(WalletRepository.memTransactions.length + 1),
      userId,
      orderId,
      type,
      direction,
      amount: roundedAmount,
      balanceAfter: roundedBalance,
      description,
      createdAt: new Date().toISOString(),
    };
    WalletRepository.memTransactions.unshift(memTxn);
    // Keep only the latest 200 entries in memory
    if (WalletRepository.memTransactions.length > 200) {
      WalletRepository.memTransactions = WalletRepository.memTransactions.slice(0, 200);
    }
  }

  /**
   * Fetch the most recent wallet transactions for a user (newest first).
   */
  public async getTransactions(
    userId: string,
    limit = 50
  ): Promise<WalletTransactionEntity[]> {
    try {
      const result = await db.query<IWalletTransactionRow>(
        `SELECT id, user_id, order_id, type, amount, direction, balance_after, description, created_at
         FROM wallet_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      if (result.rows.length > 0) {
        return result.rows.map((r) => this.mapTxnRowToEntity(r));
      }
    } catch {
      // Fallback to in-memory ledger
    }

    return WalletRepository.memTransactions
      .filter((t) => t.userId === userId)
      .slice(0, limit);
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
