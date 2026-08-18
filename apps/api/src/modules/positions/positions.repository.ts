import { db, type PoolClient } from '@trademitra/database';
import type { OptionPositionEntity } from '@trademitra/shared';

export interface IPositionRow {
  id: string;
  user_id: string;
  contract_id: string;
  product_type: 'NRML' | 'MIS';
  net_quantity: string | number;
  buy_quantity: string | number;
  sell_quantity: string | number;
  buy_amount: string | number;
  sell_amount: string | number;
  average_buy_price: string | number;
  average_sell_price: string | number;
  realized_pnl: string | number;
  status: 'OPEN' | 'CLOSED';
  created_at: Date | string;
  updated_at: Date | string;
  // Joined fields
  trading_symbol?: string;
  symbol?: string;
  strike_price?: string | number;
  option_type?: 'CE' | 'PE';
  lot_size?: number;
}

export class PositionsRepository {
  private static readonly memPositions = new Map<string, OptionPositionEntity>();

  private mapRowToEntity(row: IPositionRow): OptionPositionEntity {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      contractId: String(row.contract_id),
      productType: row.product_type,
      netQuantity: Number(row.net_quantity),
      buyQuantity: Number(row.buy_quantity),
      sellQuantity: Number(row.sell_quantity),
      buyAmount: Number(row.buy_amount),
      sellAmount: Number(row.sell_amount),
      averageBuyPrice: Number(row.average_buy_price),
      averageSellPrice: Number(row.average_sell_price),
      realizedPnl: Number(row.realized_pnl),
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  public async getPositionsByUserId(userId: string): Promise<OptionPositionEntity[]> {
    try {
      const result = await db.query<IPositionRow>(
        `SELECT id, user_id, contract_id, product_type, net_quantity, buy_quantity, sell_quantity,
                buy_amount, sell_amount, average_buy_price, average_sell_price, realized_pnl,
                status, created_at, updated_at
         FROM option_positions
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows.map((r) => this.mapRowToEntity(r));
      }
    } catch {
      // Fallback
    }

    return Array.from(PositionsRepository.memPositions.values()).filter(
      (p) => p.userId === userId
    );
  }

  public async getPositionForUpdate(
    client: PoolClient | null,
    userId: string,
    contractId: string,
    productType: 'NRML' | 'MIS'
  ): Promise<OptionPositionEntity | null> {
    try {
      if (client) {
        const result = await client.query<IPositionRow>(
          `SELECT id, user_id, contract_id, product_type, net_quantity, buy_quantity, sell_quantity,
                  buy_amount, sell_amount, average_buy_price, average_sell_price, realized_pnl,
                  status, created_at, updated_at
           FROM option_positions
           WHERE user_id = $1 AND contract_id = $2 AND product_type = $3
           FOR UPDATE`,
          [userId, contractId, productType]
        );

        if (result.rows.length > 0) {
          return this.mapRowToEntity(result.rows[0]!);
        }
      }
    } catch {
      // Fallback
    }

    const key = `${userId}_${contractId}_${productType}`;
    return PositionsRepository.memPositions.get(key) ?? null;
  }

  public async getPosition(
    userId: string,
    contractId: string,
    productType: 'NRML' | 'MIS'
  ): Promise<OptionPositionEntity | null> {
    return this.getPositionForUpdate(null, userId, contractId, productType);
  }

  public async upsertPosition(
    client: PoolClient | null,
    position: Partial<OptionPositionEntity> & {
      userId: string;
      contractId: string;
      productType: 'NRML' | 'MIS';
    }
  ): Promise<OptionPositionEntity> {
    try {
      if (client) {
        const result = await client.query<IPositionRow>(
          `INSERT INTO option_positions (
             user_id, contract_id, product_type, net_quantity, buy_quantity, sell_quantity,
             buy_amount, sell_amount, average_buy_price, average_sell_price, realized_pnl, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (user_id, contract_id, product_type)
           DO UPDATE SET
             net_quantity = EXCLUDED.net_quantity,
             buy_quantity = EXCLUDED.buy_quantity,
             sell_quantity = EXCLUDED.sell_quantity,
             buy_amount = EXCLUDED.buy_amount,
             sell_amount = EXCLUDED.sell_amount,
             average_buy_price = EXCLUDED.average_buy_price,
             average_sell_price = EXCLUDED.average_sell_price,
             realized_pnl = EXCLUDED.realized_pnl,
             status = EXCLUDED.status,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id, user_id, contract_id, product_type, net_quantity, buy_quantity, sell_quantity,
                     buy_amount, sell_amount, average_buy_price, average_sell_price, realized_pnl,
                     status, created_at, updated_at`,
          [
            position.userId,
            position.contractId,
            position.productType,
            position.netQuantity ?? 0,
            position.buyQuantity ?? 0,
            position.sellQuantity ?? 0,
            position.buyAmount ?? 0,
            position.sellAmount ?? 0,
            position.averageBuyPrice ?? 0,
            position.averageSellPrice ?? 0,
            position.realizedPnl ?? 0,
            position.status ?? 'OPEN',
          ]
        );

        if (result.rows.length > 0) {
          return this.mapRowToEntity(result.rows[0]!);
        }
      }
    } catch {
      // Fallback
    }

    const key = `${position.userId}_${position.contractId}_${position.productType}`;
    const existing = PositionsRepository.memPositions.get(key);
    const updated: OptionPositionEntity = {
      id: existing?.id ?? String(Date.now()),
      userId: position.userId,
      contractId: position.contractId,
      productType: position.productType,
      netQuantity: position.netQuantity ?? existing?.netQuantity ?? 0,
      buyQuantity: position.buyQuantity ?? existing?.buyQuantity ?? 0,
      sellQuantity: position.sellQuantity ?? existing?.sellQuantity ?? 0,
      buyAmount: position.buyAmount ?? existing?.buyAmount ?? 0,
      sellAmount: position.sellAmount ?? existing?.sellAmount ?? 0,
      averageBuyPrice: position.averageBuyPrice ?? existing?.averageBuyPrice ?? 0,
      averageSellPrice: position.averageSellPrice ?? existing?.averageSellPrice ?? 0,
      realizedPnl: position.realizedPnl ?? existing?.realizedPnl ?? 0,
      status: (position.netQuantity ?? existing?.netQuantity ?? 0) === 0 ? 'CLOSED' : 'OPEN',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    PositionsRepository.memPositions.set(key, updated);
    return updated;
  }
}
