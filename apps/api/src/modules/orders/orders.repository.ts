import { db, type PoolClient } from '@trademitra/database';
import type { OptionOrderEntity } from '@trademitra/shared';
import { v4 as uuidv4 } from 'uuid';

export interface IOrderRow {
  id: string;
  client_order_id: string;
  user_id: string;
  contract_id: string;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  transaction_type: 'BUY' | 'SELL';
  product_type: 'NRML' | 'MIS';
  quantity: number;
  price: string | number | null;
  trigger_price: string | number | null;
  target_price?: string | number | null;
  trailing_stop_loss?: string | number | null;
  average_price: string | number | null;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  rejection_reason: string | null;
  executed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class OrdersRepository {
  private static readonly memOrders = new Map<string, OptionOrderEntity>();

  private mapRowToEntity(row: IOrderRow): OptionOrderEntity {
    return {
      id: String(row.id),
      clientOrderId: row.client_order_id,
      userId: String(row.user_id),
      contractId: String(row.contract_id),
      orderType: row.order_type,
      transactionType: row.transaction_type,
      productType: row.product_type,
      quantity: Number(row.quantity),
      price: row.price ? Number(row.price) : undefined,
      triggerPrice: row.trigger_price ? Number(row.trigger_price) : undefined,
      targetPrice: row.target_price ? Number(row.target_price) : undefined,
      trailingStopLoss: row.trailing_stop_loss ? Number(row.trailing_stop_loss) : undefined,
      averagePrice: row.average_price ? Number(row.average_price) : undefined,
      status: row.status,
      rejectionReason: row.rejection_reason ?? undefined,
      executedAt: row.executed_at ? new Date(row.executed_at).toISOString() : undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  public async createOrder(
    client: PoolClient | null,
    order: {
      clientOrderId?: string;
      userId: string;
      contractId: string;
      orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
      transactionType: 'BUY' | 'SELL';
      productType: 'NRML' | 'MIS';
      quantity: number;
      price?: number;
      triggerPrice?: number;
      targetPrice?: number;
      trailingStopLoss?: number;
      averagePrice?: number;
      status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
      rejectionReason?: string;
      executedAt?: string;
    }
  ): Promise<OptionOrderEntity> {
    const clientOrderId = order.clientOrderId ?? uuidv4();

    const orderEntity: OptionOrderEntity = {
      id: String(Date.now()) + Math.random().toString().slice(2, 6),
      clientOrderId,
      userId: order.userId,
      contractId: order.contractId,
      orderType: order.orderType,
      transactionType: order.transactionType,
      productType: order.productType,
      quantity: order.quantity,
      price: order.price,
      triggerPrice: order.triggerPrice,
      targetPrice: order.targetPrice,
      trailingStopLoss: order.trailingStopLoss,
      averagePrice: order.averagePrice,
      status: order.status,
      rejectionReason: order.rejectionReason,
      executedAt: order.executedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    OrdersRepository.memOrders.set(orderEntity.id, orderEntity);

    try {
      if (client) {
        const result = await client.query<IOrderRow>(
          `INSERT INTO option_orders (
             client_order_id, user_id, contract_id, order_type, transaction_type,
             product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
             rejection_reason, executed_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id, client_order_id, user_id, contract_id, order_type, transaction_type,
                     product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
                     rejection_reason, executed_at, created_at, updated_at`,
          [
            clientOrderId,
            order.userId,
            order.contractId,
            order.orderType,
            order.transactionType,
            order.productType,
            order.quantity,
            order.price ?? null,
            order.triggerPrice ?? null,
            order.targetPrice ?? null,
            order.trailingStopLoss ?? null,
            order.averagePrice ?? null,
            order.status,
            order.rejectionReason ?? null,
            order.executedAt ? new Date(order.executedAt) : null,
          ]
        );

        if (result.rows.length > 0) {
          const dbEntity = this.mapRowToEntity(result.rows[0]!);
          OrdersRepository.memOrders.set(dbEntity.id, dbEntity);
          return dbEntity;
        }
      }
    } catch {
      // Fallback
    }

    return orderEntity;
  }

  public async getOrdersByUserId(userId: string, status?: string): Promise<OptionOrderEntity[]> {
    const orderMap = new Map<string, OptionOrderEntity>();

    // 1. Load from in-memory store
    for (const ord of OrdersRepository.memOrders.values()) {
      if (ord.userId === userId && (!status || ord.status === status)) {
        orderMap.set(ord.id, ord);
      }
    }

    // 2. Query database and merge
    try {
      let query = `
        SELECT id, client_order_id, user_id, contract_id, order_type, transaction_type,
               product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
               rejection_reason, executed_at, created_at, updated_at
        FROM option_orders
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await db.query<IOrderRow>(query, params);
      if (result.rows.length > 0) {
        for (const r of result.rows) {
          const entity = this.mapRowToEntity(r);
          orderMap.set(entity.id, entity);
          OrdersRepository.memOrders.set(entity.id, entity);
        }
      }
    } catch {
      // Fallback
    }

    return Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async getOrderById(id: string): Promise<OptionOrderEntity | null> {
    try {
      const result = await db.query<IOrderRow>(
        `SELECT id, client_order_id, user_id, contract_id, order_type, transaction_type,
                product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
                rejection_reason, executed_at, created_at, updated_at
         FROM option_orders
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length > 0) {
        return this.mapRowToEntity(result.rows[0]!);
      }
    } catch {
      // Fallback
    }

    return OrdersRepository.memOrders.get(id) ?? null;
  }

  public async updateOrder(
    client: PoolClient | null,
    orderId: string,
    updates: {
      price?: number;
      triggerPrice?: number;
      targetPrice?: number;
      trailingStopLoss?: number;
      quantity?: number;
      status?: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
      averagePrice?: number;
      rejectionReason?: string;
      executedAt?: string;
    }
  ): Promise<OptionOrderEntity | null> {
    try {
      if (client) {
        const result = await client.query<IOrderRow>(
          `UPDATE option_orders
           SET price = COALESCE($2, price),
               trigger_price = COALESCE($3, trigger_price),
               target_price = COALESCE($4, target_price),
               trailing_stop_loss = COALESCE($5, trailing_stop_loss),
               quantity = COALESCE($6, quantity),
               status = COALESCE($7, status),
               average_price = COALESCE($8, average_price),
               rejection_reason = COALESCE($9, rejection_reason),
               executed_at = COALESCE($10, executed_at),
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, client_order_id, user_id, contract_id, order_type, transaction_type,
                     product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
                     rejection_reason, executed_at, created_at, updated_at`,
          [
            orderId,
            updates.price ?? null,
            updates.triggerPrice ?? null,
            updates.targetPrice ?? null,
            updates.trailingStopLoss ?? null,
            updates.quantity ?? null,
            updates.status ?? null,
            updates.averagePrice ?? null,
            updates.rejectionReason ?? null,
            updates.executedAt ? new Date(updates.executedAt) : null,
          ]
        );

        if (result.rows.length > 0) {
          const entity = this.mapRowToEntity(result.rows[0]!);
          OrdersRepository.memOrders.set(entity.id, entity);
          return entity;
        }
      }
    } catch {
      // Fallback
    }

    const existing = OrdersRepository.memOrders.get(orderId);
    if (!existing) return null;

    const updated: OptionOrderEntity = {
      ...existing,
      price: updates.price !== undefined ? updates.price : existing.price,
      triggerPrice: updates.triggerPrice !== undefined ? updates.triggerPrice : existing.triggerPrice,
      targetPrice: updates.targetPrice !== undefined ? updates.targetPrice : existing.targetPrice,
      trailingStopLoss: updates.trailingStopLoss !== undefined ? updates.trailingStopLoss : existing.trailingStopLoss,
      quantity: updates.quantity !== undefined ? updates.quantity : existing.quantity,
      status: updates.status ?? existing.status,
      averagePrice: updates.averagePrice ?? existing.averagePrice,
      rejectionReason: updates.rejectionReason ?? existing.rejectionReason,
      executedAt: updates.executedAt ?? existing.executedAt,
      updatedAt: new Date().toISOString(),
    };
    OrdersRepository.memOrders.set(orderId, updated);
    return updated;
  }

  public async getAllPendingOrders(): Promise<OptionOrderEntity[]> {
    try {
      const result = await db.query<IOrderRow>(
        `SELECT id, client_order_id, user_id, contract_id, order_type, transaction_type,
                product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
                rejection_reason, executed_at, created_at, updated_at
         FROM option_orders
         WHERE status = 'PENDING'
         ORDER BY created_at ASC`
      );

      if (result.rows.length > 0) {
        return result.rows.map((r) => this.mapRowToEntity(r));
      }
    } catch {
      // Fallback
    }

    return Array.from(OrdersRepository.memOrders.values()).filter((o) => o.status === 'PENDING');
  }

  public async cancelAllPendingOrders(client: PoolClient | null, userId: string): Promise<OptionOrderEntity[]> {
    try {
      if (client) {
        const result = await client.query<IOrderRow>(
          `UPDATE option_orders
           SET status = 'CANCELLED',
               updated_at = NOW()
           WHERE user_id = $1 AND status = 'PENDING'
           RETURNING id, client_order_id, user_id, contract_id, order_type, transaction_type,
                     product_type, quantity, price, trigger_price, target_price, trailing_stop_loss, average_price, status,
                     rejection_reason, executed_at, created_at, updated_at`,
          [userId]
        );

        if (result.rows.length > 0) {
          return result.rows.map((r) => {
            const entity = this.mapRowToEntity(r);
            OrdersRepository.memOrders.set(entity.id, entity);
            return entity;
          });
        }
      }
    } catch {
      // Fallback
    }

    const cancelled: OptionOrderEntity[] = [];
    for (const [id, ord] of OrdersRepository.memOrders.entries()) {
      if (ord.userId === userId && ord.status === 'PENDING') {
        const updated: OptionOrderEntity = {
          ...ord,
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
        };
        OrdersRepository.memOrders.set(id, updated);
        cancelled.push(updated);
      }
    }
    return cancelled;
  }
}
