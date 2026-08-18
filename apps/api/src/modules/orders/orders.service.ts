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

    const tick = this.feedProvider.getLatestTick(contract.tradingSymbol);
    const ltp = tick?.ltp ?? (contract.optionType === 'CE' ? 120.5 : 95.2);
    const executionPrice = dto.orderType === 'MARKET' ? ltp : dto.price ?? ltp;

    // Strict Stop Loss & Target validation for BUY orders
    if (dto.transactionType === 'BUY') {
      if (dto.triggerPrice !== undefined && dto.triggerPrice > 0 && dto.triggerPrice >= executionPrice) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) cannot be greater than or equal to Buy price (₹${executionPrice.toFixed(2)}). Stop loss must be below your buy amount.`
        );
      }
      if (dto.targetPrice !== undefined && dto.targetPrice > 0 && dto.targetPrice <= executionPrice) {
        throw new ValidationError(
          `Target price (₹${dto.targetPrice.toFixed(2)}) must be greater than Buy price (₹${executionPrice.toFixed(2)}).`
        );
      }
    }
    
    // Standard Indian F&O Option Selling SPAN Margin per lot (~₹1,15,000 / lot)
    const OPTION_SELLING_MARGIN_PER_LOT = 115000;
    const lotSize = contract.lotSize || 25;
    const lots = Math.max(1, Math.round(dto.quantity / lotSize));
    const premiumTurnover = Number((dto.quantity * executionPrice).toFixed(2));

    // 3. Execute financial transaction with row-level locking
    const executeOrderInTx = async (client: any = null): Promise<OptionOrderEntity> => {
      // Lock Wallet
      const wallet = client
        ? await this.walletRepo.getWalletByUserIdForUpdate(client, userId)
        : await this.walletRepo.getWalletByUserId(userId);

      if (!wallet) throw new NotFoundError('User wallet not found.');

      // Lock existing Position
      const existingPos = await this.positionsRepo.getPositionForUpdate(
        client,
        userId,
        contract.id,
        dto.productType
      );

      const isClosingLong = dto.transactionType === 'SELL' && existingPos && existingPos.netQuantity > 0;
      const isClosingShort = dto.transactionType === 'BUY' && existingPos && existingPos.netQuantity < 0;

      // Required Margin:
      // - BUY: Premium required (if not closing short)
      // - SELL: SPAN margin required (if opening fresh short, 0 if closing long)
      const requiredMargin =
        dto.transactionType === 'BUY'
          ? (isClosingShort ? 0 : premiumTurnover)
          : (isClosingLong ? 0 : Number((lots * OPTION_SELLING_MARGIN_PER_LOT).toFixed(2)));

      if (requiredMargin > 0 && wallet.availableMargin < requiredMargin) {
        throw new InsufficientFundsError(
          `Insufficient margin. Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${wallet.availableMargin.toLocaleString('en-IN')}`
        );
      }

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
        targetPrice: dto.targetPrice,
        trailingStopLoss: dto.trailingStopLoss,
        averagePrice: avgPrice,
        status: orderStatus,
        executedAt,
      });

      if (isMarket) {
        // Update Wallet Margin
        let newUtilized = wallet.utilizedMargin;
        if (dto.transactionType === 'BUY') {
          if (isClosingShort) {
            const closingLots = Math.ceil(Math.min(dto.quantity, Math.abs(existingPos.netQuantity)) / lotSize);
            newUtilized = Math.max(0, wallet.utilizedMargin - (closingLots * OPTION_SELLING_MARGIN_PER_LOT));
          } else {
            newUtilized = wallet.utilizedMargin + requiredMargin;
          }
        } else {
          // SELL transaction
          if (isClosingLong) {
            const closingBuyAmt = Math.min(dto.quantity, existingPos.netQuantity) * existingPos.averageBuyPrice;
            newUtilized = Math.max(0, wallet.utilizedMargin - closingBuyAmt);
          } else {
            newUtilized = wallet.utilizedMargin + requiredMargin;
          }
        }

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

        // 1. If position is manually closed (netQty === 0), auto-cancel any existing pending SL/Target protection orders
        if (netQty === 0) {
          const userOrders = await this.ordersRepo.getOrdersByUserId(userId, 'PENDING');
          for (const pendingOrd of userOrders) {
            if (pendingOrd.contractId === contract.id && pendingOrd.productType === dto.productType) {
              logger.info(
                `[BracketEngine] Position closed. Auto-cancelling orphaned protection order #${pendingOrd.id} (${pendingOrd.orderType})`
              );
              await this.ordersRepo.updateOrder(client, pendingOrd.id, {
                status: 'CANCELLED',
                rejectionReason: 'Position closed by user exit',
              });
            }
          }
        }

        // 2. Bracket Order: If BUY/SELL order has Stop Loss or Target Price, auto-create the pending protection order
        if (dto.triggerPrice || dto.targetPrice) {
          const exitTrigger = dto.triggerPrice;
          const exitTarget = dto.targetPrice;
          const exitTrail = dto.trailingStopLoss;
          const reverseAction = dto.transactionType === 'BUY' ? 'SELL' : 'BUY';

          logger.info(
            `[BracketEngine] Creating automated exit protection order for ${dto.transactionType} trade #${order.id}: SL: ₹${exitTrigger}, Target: ₹${exitTarget}, Trail: ₹${exitTrail}`
          );

          await this.ordersRepo.createOrder(client, {
            userId,
            contractId: contract.id,
            orderType: exitTrigger ? 'SL-M' : 'LIMIT',
            transactionType: reverseAction,
            productType: dto.productType,
            quantity: dto.quantity,
            price: exitTarget || executionPrice,
            triggerPrice: exitTrigger,
            targetPrice: exitTarget,
            trailingStopLoss: exitTrail,
            status: 'PENDING',
          });
        }
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
    const orders = await this.ordersRepo.getOrdersByUserId(userId, status);
    
    // Enrich orders with live market contract details & tick LTP
    return Promise.all(
      orders.map(async (order) => {
        try {
          const contract = await this.contractsRepo.getContractById(order.contractId);
          if (contract) {
            const tick = this.feedProvider.getLatestTick(contract.tradingSymbol);
            return {
              ...order,
              tradingSymbol: contract.tradingSymbol,
              strikePrice: contract.strikePrice,
              optionType: contract.optionType,
              symbol: contract.symbol,
              ltp: tick?.ltp ?? contract.strikePrice,
            };
          }
        } catch {
          // Keep raw order if lookup fails
        }
        return order;
      })
    );
  }

  public async getOrderById(id: string): Promise<OptionOrderEntity> {
    const order = await this.ordersRepo.getOrderById(id);
    if (!order) throw new NotFoundError('Order not found.');
    return order;
  }

  public async modifyOrder(
    userId: string,
    orderId: string,
    dto: { price?: number; triggerPrice?: number; targetPrice?: number; trailingStopLoss?: number; quantity?: number }
  ): Promise<OptionOrderEntity> {
    const existing = await this.ordersRepo.getOrderById(orderId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Order not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ValidationError('Only PENDING orders can be modified.');
    }

    const orderExecPrice = dto.price ?? existing.price ?? existing.averagePrice ?? 0;
    const isBuy = existing.transactionType === 'BUY';

    if (isBuy && orderExecPrice > 0) {
      if (dto.triggerPrice !== undefined && dto.triggerPrice > 0 && dto.triggerPrice >= orderExecPrice) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) cannot be greater than or equal to Buy price (₹${orderExecPrice.toFixed(2)}). Stop loss must be below your buy amount.`
        );
      }
      if (dto.targetPrice !== undefined && dto.targetPrice > 0 && dto.targetPrice <= orderExecPrice) {
        throw new ValidationError(
          `Target price (₹${dto.targetPrice.toFixed(2)}) must be greater than Buy price (₹${orderExecPrice.toFixed(2)}).`
        );
      }
    }

    const updated = await this.ordersRepo.updateOrder(null, orderId, {
      price: dto.price,
      triggerPrice: dto.triggerPrice,
      targetPrice: dto.targetPrice,
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

          // For SELL stop-loss (protecting Long BUY position)
          if (order.transactionType === 'SELL') {
            // Formula: If price is above triggerPrice + trailStep, trail the SL up so distance = trailStep
            // E.g. BUY @ 260, SL = 210 (distance 50). If LTP rises to 280, new SL = 280 - 50 = 230!
            const newTrigger = Number((currentLtp - trailStep).toFixed(2));
            if (newTrigger > order.triggerPrice) {
              const oldTrigger = order.triggerPrice;
              logger.info(
                `[TrailingSL] Trailing trigger price UP for Order #${order.id} (${contract.tradingSymbol}): ₹${oldTrigger} -> ₹${newTrigger} (LTP: ₹${currentLtp}, Trail: ₹${trailStep})`
              );
              await this.ordersRepo.updateOrder(null, order.id, {
                triggerPrice: newTrigger,
              });
              order.triggerPrice = newTrigger;

              // Broadcast live SL trigger update to frontend
              this.feedProvider.emit('order:update', { userId: order.userId, orderId: order.id });
            }
          }
          // For BUY stop-loss (protecting Short SELL position)
          else if (order.transactionType === 'BUY') {
            const newTrigger = Number((currentLtp + trailStep).toFixed(2));
            if (newTrigger < order.triggerPrice) {
              const oldTrigger = order.triggerPrice;
              logger.info(
                `[TrailingSL] Trailing trigger price DOWN for Short Order #${order.id}: ₹${oldTrigger} -> ₹${newTrigger} (LTP: ₹${currentLtp}, Trail: ₹${trailStep})`
              );
              await this.ordersRepo.updateOrder(null, order.id, {
                triggerPrice: newTrigger,
              });
              order.triggerPrice = newTrigger;

              // Broadcast live SL trigger update to frontend
              this.feedProvider.emit('order:update', { userId: order.userId, orderId: order.id });
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

          // Target Profit Exit
          if (!shouldTrigger && order.targetPrice) {
            // SELL Target (Target hit on price rise: currentLtp >= targetPrice)
            if (order.transactionType === 'SELL' && currentLtp >= order.targetPrice) {
              shouldTrigger = true;
              executionPrice = currentLtp;
              logger.info(`[TargetEngine] Target Profit hit for Order #${order.id} at LTP ₹${currentLtp} >= Target ₹${order.targetPrice}`);
            }
            // BUY Target (Short target hit on price drop: currentLtp <= targetPrice)
            else if (order.transactionType === 'BUY' && currentLtp <= order.targetPrice) {
              shouldTrigger = true;
              executionPrice = currentLtp;
              logger.info(`[TargetEngine] Short Target Profit hit for Order #${order.id} at LTP ₹${currentLtp} <= Target ₹${order.targetPrice}`);
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

          // Bracket Order for LIMIT Entry: If BUY LIMIT order just filled and had SL/Target, create the pending protection order
          if (order.transactionType === 'BUY' && (order.triggerPrice || order.targetPrice)) {
            const exitTrigger = order.triggerPrice;
            const exitTarget = order.targetPrice;
            const exitTrail = order.trailingStopLoss;

            logger.info(
              `[BracketEngine] LIMIT Buy Order #${order.id} executed at ₹${executionPrice}. Auto-creating pending protection order: SL: ₹${exitTrigger}, Target: ₹${exitTarget}, Trail: ₹${exitTrail}`
            );

            await this.ordersRepo.createOrder(null, {
              userId: order.userId,
              contractId: contract.id,
              orderType: exitTrigger ? 'SL-M' : 'LIMIT',
              transactionType: 'SELL',
              productType: order.productType,
              quantity: order.quantity,
              price: exitTarget,
              triggerPrice: exitTrigger,
              targetPrice: exitTarget,
              trailingStopLoss: exitTrail,
              status: 'PENDING',
            });

            this.feedProvider.emit('order:update', { userId: order.userId });
          }

          // If position became CLOSED (netQty === 0), auto-cancel any remaining pending orders for this contract
          if (netQty === 0) {
            const userOrders = await this.ordersRepo.getOrdersByUserId(order.userId, 'PENDING');
            for (const pendingOrd of userOrders) {
              if (pendingOrd.contractId === contract.id && pendingOrd.id !== order.id) {
                logger.info(
                  `[OrderExecutionEngine] Position closed via execution. Auto-cancelling leftover order #${pendingOrd.id}`
                );
                await this.ordersRepo.updateOrder(null, pendingOrd.id, {
                  status: 'CANCELLED',
                  rejectionReason: 'Position closed by automated execution',
                });
              }
            }
          }

          // Broadcast order execution event
          this.feedProvider.emit('order:update', { userId: order.userId });
        }
      }
    } catch (err: any) {
      logger.error(`[OrderExecutionEngine] Error processing tick: ${err?.message}`);
    }
  }
}
