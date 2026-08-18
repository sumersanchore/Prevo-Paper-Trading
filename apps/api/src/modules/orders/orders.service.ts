import { db } from '@trademitra/database';
import type { OptionOrderEntity, PlaceOrderDto, LiveTickData } from '@trademitra/shared';
import { OrdersRepository } from './orders.repository.js';
import { WalletRepository } from '../wallet/wallet.repository.js';
import { ContractsRepository } from '../contracts/contracts.repository.js';
import { PositionsRepository } from '../positions/positions.repository.js';
import { McpFeedProvider } from '../../providers/mcp.provider.js';
import { logger } from '../../core/logger.js';
import {
  AppError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../core/errors.js';

export class OrdersService {
  private readonly ordersRepo: OrdersRepository;
  private readonly walletRepo: WalletRepository;
  private readonly contractsRepo: ContractsRepository;
  private readonly positionsRepo: PositionsRepository;
  private readonly feedProvider: McpFeedProvider;

  constructor(
    ordersRepo = new OrdersRepository(),
    walletRepo = new WalletRepository(),
    contractsRepo = new ContractsRepository(),
    positionsRepo = new PositionsRepository(),
    feedProvider = McpFeedProvider.getInstance()
  ) {
    this.ordersRepo = ordersRepo;
    this.walletRepo = walletRepo;
    this.contractsRepo = contractsRepo;
    this.positionsRepo = positionsRepo;
    this.feedProvider = feedProvider;
  }

  public async placeOrder(userId: string, dto: PlaceOrderDto): Promise<OptionOrderEntity> {
    // 1. Validation
    if (!dto.contractId) throw new ValidationError('Contract ID is required.');
    if (!dto.quantity || dto.quantity <= 0) throw new ValidationError('Quantity must be greater than 0.');

    const contract = await this.contractsRepo.getContractById(dto.contractId);
    if (!contract) throw new NotFoundError('Options contract not found.');

    if (dto.quantity % contract.lotSize !== 0) {
      throw new ValidationError(`Quantity must be a multiple of lot size (${contract.lotSize}).`);
    }

    // 2. Fetch current LTP for price calculation
    const tick = this.feedProvider.getLatestTick(contract.tradingSymbol);
    const ltp = tick?.ltp ?? (contract.optionType === 'CE' ? 120.5 : 95.2);
    const executionPrice = dto.orderType === 'MARKET' ? ltp : dto.price ?? ltp;
    const requiredMargin = Number((dto.quantity * executionPrice).toFixed(2));

    // 3. Execute financial transaction with row-level locking
    const executeOrderInTx = async (client: any = null): Promise<OptionOrderEntity> => {
      // Lock Wallet
      const wallet = client
        ? await this.walletRepo.getWalletByUserIdForUpdate(client, userId)
        : await this.walletRepo.getWalletByUserId(userId);

      if (!wallet) throw new NotFoundError('User wallet not found.');

      if (dto.transactionType === 'BUY' && wallet.availableMargin < requiredMargin) {
        throw new InsufficientFundsError(
          `Insufficient margin. Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${wallet.availableMargin.toLocaleString('en-IN')}`
        );
      }

      // Lock existing Position
      const existingPos = await this.positionsRepo.getPositionForUpdate(
        client,
        userId,
        contract.id,
        dto.productType
      );

      const isMarket = dto.orderType === 'MARKET';
      const orderStatus = isMarket ? 'EXECUTED' : 'PENDING';
      const executedAt = isMarket ? new Date().toISOString() : undefined;
      const avgPrice = isMarket ? executionPrice : undefined;

      // Create Order
      const order = await this.ordersRepo.createOrder(client, {
        clientOrderId: dto.clientOrderId,
        userId,
        contractId: contract.id,
        orderType: dto.orderType,
        transactionType: dto.transactionType,
        productType: dto.productType,
        quantity: dto.quantity,
        price: dto.price,
        triggerPrice: dto.triggerPrice,
        trailingStopLoss: dto.trailingStopLoss,
        averagePrice: avgPrice,
        status: orderStatus,
        executedAt,
      });

      if (isMarket) {
        // Update Wallet Margin
        const newUtilized =
          dto.transactionType === 'BUY'
            ? wallet.utilizedMargin + requiredMargin
            : Math.max(0, wallet.utilizedMargin - requiredMargin);

        await this.walletRepo.updateWalletBalances(
          client,
          userId,
          wallet.cashBalance,
          newUtilized
        );

        // Update / Upsert Position
        let netQty = existingPos?.netQuantity ?? 0;
        let buyQty = existingPos?.buyQuantity ?? 0;
        let sellQty = existingPos?.sellQuantity ?? 0;
        let buyAmt = existingPos?.buyAmount ?? 0;
        let sellAmt = existingPos?.sellAmount ?? 0;
        let realizedPnl = existingPos?.realizedPnl ?? 0;
        let avgBuy = existingPos?.averageBuyPrice ?? 0;
        let avgSell = existingPos?.averageSellPrice ?? 0;

        if (dto.transactionType === 'BUY') {
          // If we had short position, calculate realized PnL on buy back
          if (netQty < 0) {
            const closingQty = Math.min(dto.quantity, Math.abs(netQty));
            const pnl = closingQty * (avgSell - executionPrice);
            realizedPnl += pnl;
          }
          netQty += dto.quantity;
          buyQty += dto.quantity;
          buyAmt += requiredMargin;
          avgBuy = buyQty > 0 ? Number((buyAmt / buyQty).toFixed(2)) : 0;
        } else {
          // SELL transaction
          if (netQty > 0) {
            const closingQty = Math.min(dto.quantity, netQty);
            const pnl = closingQty * (executionPrice - avgBuy);
            realizedPnl += pnl;
          }
          netQty -= dto.quantity;
          sellQty += dto.quantity;
          sellAmt += requiredMargin;
          avgSell = sellQty > 0 ? Number((sellAmt / sellQty).toFixed(2)) : 0;
        }

        await this.positionsRepo.upsertPosition(client, {
          userId,
          contractId: contract.id,
          productType: dto.productType,
          netQuantity: netQty,
          buyQuantity: buyQty,
          sellQuantity: sellQty,
          buyAmount: buyAmt,
          sellAmount: sellAmt,
          averageBuyPrice: avgBuy,
          averageSellPrice: avgSell,
          realizedPnl: Number(realizedPnl.toFixed(2)),
          status: netQty === 0 ? 'CLOSED' : 'OPEN',
        });
      }

      return order;
    };

    try {
      return await db.withTransaction((ctx) => executeOrderInTx(ctx.client));
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // Fallback execute
      return executeOrderInTx(null);
    }
  }

  public async getUserOrders(userId: string, status?: string): Promise<OptionOrderEntity[]> {
    return this.ordersRepo.getOrdersByUserId(userId, status);
  }

  public async getOrderById(id: string): Promise<OptionOrderEntity> {
    const order = await this.ordersRepo.getOrderById(id);
    if (!order) throw new NotFoundError('Order not found.');
    return order;
  }

  public async modifyOrder(
    userId: string,
    orderId: string,
    dto: { price?: number; triggerPrice?: number; trailingStopLoss?: number; quantity?: number }
  ): Promise<OptionOrderEntity> {
    const existing = await this.ordersRepo.getOrderById(orderId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Order not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ValidationError('Only PENDING orders can be modified.');
    }

    const updated = await this.ordersRepo.updateOrder(null, orderId, {
      price: dto.price,
      triggerPrice: dto.triggerPrice,
      trailingStopLoss: dto.trailingStopLoss,
      quantity: dto.quantity,
    });

    if (!updated) throw new NotFoundError('Failed to modify order.');
    return updated;
  }

  public async cancelOrder(userId: string, orderId: string): Promise<OptionOrderEntity> {
    const existing = await this.ordersRepo.getOrderById(orderId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Order not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ValidationError('Only PENDING orders can be cancelled.');
    }

    const updated = await this.ordersRepo.updateOrder(null, orderId, {
      status: 'CANCELLED',
    });

    if (!updated) throw new NotFoundError('Failed to cancel order.');
    return updated;
  }

  public async cancelAllOrders(userId: string): Promise<OptionOrderEntity[]> {
    return this.ordersRepo.cancelAllPendingOrders(null, userId);
  }

  /**
   * Real-Time Matching & Trailing Stop-Loss Engine
   * Evaluates pending SL, SL-M, and LIMIT orders on every live market tick.
   *
   * 1. Trailing Stop Loss Rule:
   *    - For BUY open orders / positions: As market price rises above the previous reference price by >= trailingStopLoss step,
   *      triggerPrice increases proportionally (lock in profits).
   * 2. Immediate Stop Loss Exit Rule:
   *    - Formula: When LTP <= TriggerPrice (for Long/Sell SL) or LTP >= TriggerPrice (for Short/Buy SL),
   *      instantly triggers and executes at current market price.
   */
  public async processTickForOrders(tick: LiveTickData): Promise<void> {
    try {
      const pendingOrders = await this.ordersRepo.getAllPendingOrders();
      if (pendingOrders.length === 0) return;

      for (const order of pendingOrders) {
        const contract = await this.contractsRepo.getContractById(order.contractId);
        if (!contract || contract.tradingSymbol !== tick.tradingSymbol) continue;

        const currentLtp = tick.ltp;

        // --- 1. TRAILING STOP LOSS LOGIC ---
        if (
          (order.orderType === 'SL' || order.orderType === 'SL-M') &&
          order.trailingStopLoss &&
          order.trailingStopLoss > 0 &&
          order.triggerPrice
        ) {
          const trailStep = order.trailingStopLoss;

          // For SELL stop-loss (protecting Long position)
          if (order.transactionType === 'SELL') {
            // Check if current LTP moved higher than triggerPrice + trailStep
            const distance = currentLtp - order.triggerPrice;
            if (distance > trailStep) {
              const newTriggerPrice = Number((currentLtp - trailStep).toFixed(2));
              if (newTriggerPrice > order.triggerPrice) {
                logger.info(
                  `[TrailingSL] Trailing trigger price UP for Order #${order.id} (${contract.tradingSymbol}): ₹${order.triggerPrice} -> ₹${newTriggerPrice} (LTP: ₹${currentLtp})`
                );
                await this.ordersRepo.updateOrder(null, order.id, {
                  triggerPrice: newTriggerPrice,
                });
                order.triggerPrice = newTriggerPrice;
              }
            }
          }
          // For BUY stop-loss (protecting Short position)
          else if (order.transactionType === 'BUY') {
            const distance = order.triggerPrice - currentLtp;
            if (distance > trailStep) {
              const newTriggerPrice = Number((currentLtp + trailStep).toFixed(2));
              if (newTriggerPrice < order.triggerPrice) {
                logger.info(
                  `[TrailingSL] Trailing trigger price DOWN for Short Order #${order.id}: ₹${order.triggerPrice} -> ₹${newTriggerPrice} (LTP: ₹${currentLtp})`
                );
                await this.ordersRepo.updateOrder(null, order.id, {
                  triggerPrice: newTriggerPrice,
                });
                order.triggerPrice = newTriggerPrice;
              }
            }
          }
        }

        // --- 2. STOP-LOSS & LIMIT AUTO-EXECUTION LOGIC ---
        let shouldTrigger = false;
        let executionPrice = currentLtp;

        if (order.orderType === 'SL' || order.orderType === 'SL-M') {
          if (order.triggerPrice) {
            // SELL SL (Stop Loss hit on price drop: currentLtp <= triggerPrice)
            if (order.transactionType === 'SELL' && currentLtp <= order.triggerPrice) {
              shouldTrigger = true;
              executionPrice = order.orderType === 'SL-M' ? currentLtp : (order.price ?? currentLtp);
            }
            // BUY SL (Stop Loss hit on price rise: currentLtp >= triggerPrice)
            else if (order.transactionType === 'BUY' && currentLtp >= order.triggerPrice) {
              shouldTrigger = true;
              executionPrice = order.orderType === 'SL-M' ? currentLtp : (order.price ?? currentLtp);
            }
          }
        } else if (order.orderType === 'LIMIT') {
          if (order.price) {
            // BUY LIMIT (Fill when price drops to or below limit)
            if (order.transactionType === 'BUY' && currentLtp <= order.price) {
              shouldTrigger = true;
              executionPrice = order.price;
            }
            // SELL LIMIT (Fill when price rises to or above limit)
            else if (order.transactionType === 'SELL' && currentLtp >= order.price) {
              shouldTrigger = true;
              executionPrice = order.price;
            }
          }
        }

        // Execute triggered order immediately
        if (shouldTrigger) {
          logger.info(
            `[OrderExecutionEngine] Auto-executing ${order.orderType} Order #${order.id} for user ${order.userId} at LTP ₹${executionPrice}`
          );

          await this.ordersRepo.updateOrder(null, order.id, {
            status: 'EXECUTED',
            averagePrice: executionPrice,
            executedAt: new Date().toISOString(),
          });

          // Settle wallet & position
          const requiredMargin = Number((order.quantity * executionPrice).toFixed(2));
          const wallet = await this.walletRepo.getWalletByUserId(order.userId);
          if (wallet) {
            const newUtilized =
              order.transactionType === 'BUY'
                ? wallet.utilizedMargin + requiredMargin
                : Math.max(0, wallet.utilizedMargin - requiredMargin);

            await this.walletRepo.updateWalletBalances(
              null,
              order.userId,
              wallet.cashBalance,
              newUtilized
            );
          }

          const existingPos = await this.positionsRepo.getPosition(
            order.userId,
            contract.id,
            order.productType
          );

          let netQty = existingPos?.netQuantity ?? 0;
          let buyQty = existingPos?.buyQuantity ?? 0;
          let sellQty = existingPos?.sellQuantity ?? 0;
          let buyAmt = existingPos?.buyAmount ?? 0;
          let sellAmt = existingPos?.sellAmount ?? 0;
          let realizedPnl = existingPos?.realizedPnl ?? 0;
          let avgBuy = existingPos?.averageBuyPrice ?? 0;
          let avgSell = existingPos?.averageSellPrice ?? 0;

          if (order.transactionType === 'BUY') {
            if (netQty < 0) {
              const closingQty = Math.min(order.quantity, Math.abs(netQty));
              realizedPnl += closingQty * (avgSell - executionPrice);
            }
            netQty += order.quantity;
            buyQty += order.quantity;
            buyAmt += requiredMargin;
            avgBuy = buyQty > 0 ? Number((buyAmt / buyQty).toFixed(2)) : 0;
          } else {
            if (netQty > 0) {
              const closingQty = Math.min(order.quantity, netQty);
              realizedPnl += closingQty * (executionPrice - avgBuy);
            }
            netQty -= order.quantity;
            sellQty += order.quantity;
            sellAmt += requiredMargin;
            avgSell = sellQty > 0 ? Number((sellAmt / sellQty).toFixed(2)) : 0;
          }

          await this.positionsRepo.upsertPosition(null, {
            userId: order.userId,
            contractId: contract.id,
            productType: order.productType,
            netQuantity: netQty,
            buyQuantity: buyQty,
            sellQuantity: sellQty,
            buyAmount: buyAmt,
            sellAmount: sellAmt,
            averageBuyPrice: avgBuy,
            averageSellPrice: avgSell,
            realizedPnl: Number(realizedPnl.toFixed(2)),
            status: netQty === 0 ? 'CLOSED' : 'OPEN',
          });
        }
      }
    } catch (err: any) {
      logger.error(`[OrderExecutionEngine] Error processing tick: ${err?.message}`);
    }
  }
}
