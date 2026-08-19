import { db } from '@trademitra/database';
import type { OptionOrderEntity, PlaceOrderDto, LiveTickData } from '@trademitra/shared';
import { OrdersRepository } from './orders.repository.js';
import { WalletRepository } from '../wallet/wallet.repository.js';
import { ContractsRepository } from '../contracts/contracts.repository.js';
import { PositionsRepository } from '../positions/positions.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { McpFeedProvider } from '../../providers/mcp.provider.js';
import { logger } from '../../core/logger.js';
import {
  AppError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../core/errors.js';

// Standard Indian F&O Option Selling SPAN Margin per lot (~₹1,15,000 / lot)
export const OPTION_SELLING_MARGIN_PER_LOT = 115000;

export class OrdersService {
  private readonly ordersRepo: OrdersRepository;
  private readonly walletRepo: WalletRepository;
  private readonly contractsRepo: ContractsRepository;
  private readonly positionsRepo: PositionsRepository;
  private readonly notificationsService: NotificationsService;
  private readonly feedProvider: McpFeedProvider;

  constructor(
    ordersRepo = new OrdersRepository(),
    walletRepo = new WalletRepository(),
    contractsRepo = new ContractsRepository(),
    positionsRepo = new PositionsRepository(),
    notificationsService = new NotificationsService(),
    feedProvider = McpFeedProvider.getInstance()
  ) {
    this.ordersRepo = ordersRepo;
    this.walletRepo = walletRepo;
    this.contractsRepo = contractsRepo;
    this.positionsRepo = positionsRepo;
    this.notificationsService = notificationsService;
    this.feedProvider = feedProvider;

    // Periodic heartbeat to evaluate all open Stop Loss & Target orders every second
    setInterval(() => {
      this.evaluateAllPendingOrders().catch(() => {});
    }, 1000);
  }

  public async evaluateAllPendingOrders(): Promise<void> {
    try {
      const pendingOrders = await this.ordersRepo.getAllPendingOrders();
      if (!pendingOrders || pendingOrders.length === 0) return;

      for (const order of pendingOrders) {
        const contract = await this.contractsRepo.getContractById(order.contractId);
        if (!contract) continue;
        const tick = this.feedProvider.getLatestTick(contract.tradingSymbol);
        if (tick) {
          await this.processTickForOrders(tick);
        }
      }
    } catch (err: any) {
      logger.debug(`[OrdersEngine] evaluateAllPendingOrders: ${err?.message}`);
    }
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

      // ── Step 1: Margin & Amount Security Check ──────────────────────────────
      if (requiredMargin > 0 && wallet.availableMargin < requiredMargin) {
        const shortfall = Number((requiredMargin - wallet.availableMargin).toFixed(2));
        const rejectReason = `Insufficient Available Margin: ₹${shortfall.toLocaleString('en-IN')} more needed (Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${wallet.availableMargin.toLocaleString('en-IN')}, Shortfall: ₹${shortfall.toLocaleString('en-IN')})`;
        
        // Persist the rejected order record in database with explicit reason
        const rejectedOrder = await this.ordersRepo.createOrder(client, {
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
          status: 'REJECTED',
          rejectionReason: rejectReason,
          tradingSymbol: contract.tradingSymbol,
          symbol: contract.symbol,
          strikePrice: contract.strikePrice,
          optionType: contract.optionType,
        });

        const optTypeStr = contract.optionType === 'CE' ? 'Call' : 'Put';
        const friendlyName = `${contract.symbol} ${contract.strikePrice} ${optTypeStr}`.trim();
        await this.notificationsService.notifyUser({
          userId,
          title: 'Order Rejected',
          message: `${friendlyName} order rejected: Shortfall of ₹${shortfall.toLocaleString('en-IN')} (Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${wallet.availableMargin.toLocaleString('en-IN')})`,
          type: 'ORDER',
          severity: 'ERROR',
          data: {
            orderId: rejectedOrder.id,
            status: 'REJECTED',
            rejectionReason: rejectReason,
            shortfall,
            requiredMargin,
            availableMargin: wallet.availableMargin,
          },
        });

        this.feedProvider.emit('order:update', { userId, orderId: rejectedOrder.id });

        throw new InsufficientFundsError(rejectReason);
      }

      // ── Step 2: Live Price & Trigger Match Verification ─────────────────────
      let isExecutableNow = false;
      let matchedExecutionPrice = executionPrice;

      if (dto.orderType === 'MARKET') {
        isExecutableNow = true;
        matchedExecutionPrice = ltp;
      } else if (dto.orderType === 'LIMIT' && dto.price) {
        // BUY LIMIT: Matches if live LTP <= Limit Price (fills at current best market LTP)
        // SELL LIMIT: Matches if live LTP >= Limit Price (fills at current best market LTP)
        if (dto.transactionType === 'BUY' && ltp <= dto.price) {
          isExecutableNow = true;
          matchedExecutionPrice = ltp;
        } else if (dto.transactionType === 'SELL' && ltp >= dto.price) {
          isExecutableNow = true;
          matchedExecutionPrice = ltp;
        }
      } else if ((dto.orderType === 'SL' || dto.orderType === 'SL-M') && dto.triggerPrice) {
        // BUY SL: Triggers if live LTP >= Trigger Price
        // SELL SL: Triggers if live LTP <= Trigger Price
        if (dto.transactionType === 'BUY' && ltp >= dto.triggerPrice) {
          isExecutableNow = true;
          matchedExecutionPrice = dto.orderType === 'SL-M' ? ltp : (dto.price ?? ltp);
        } else if (dto.transactionType === 'SELL' && ltp <= dto.triggerPrice) {
          isExecutableNow = true;
          matchedExecutionPrice = dto.orderType === 'SL-M' ? ltp : (dto.price ?? ltp);
        }
      }

      const orderStatus = isExecutableNow ? 'EXECUTED' : 'PENDING';
      const executedAt = isExecutableNow ? new Date().toISOString() : undefined;
      const avgPrice = isExecutableNow ? matchedExecutionPrice : undefined;

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
        tradingSymbol: contract.tradingSymbol,
        symbol: contract.symbol,
        strikePrice: contract.strikePrice,
        optionType: contract.optionType,
      });

      // Notification ONLY for successfully executed trades (Buy or Sell)
      if (isExecutableNow) {
        const optTypeStr = contract.optionType === 'CE' ? 'Call' : 'Put';
        let expStr = '';
        try {
          const d = new Date(contract.expiryDate);
          const day = d.getDate();
          const monNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const mon = monNames[d.getMonth()] || '';
          expStr = `${day} ${mon}`;
        } catch {
          expStr = '';
        }
        const friendlyName = `${contract.symbol} ${expStr} ${contract.strikePrice} ${optTypeStr}`.trim();
        const productStr = dto.productType === 'MIS' ? 'intraday' : 'delivery';

        await this.notificationsService.notifyUser({
          userId,
          title: 'Executed',
          message: `${friendlyName} , ${productStr} ${dto.transactionType.toLowerCase()} order for ${dto.quantity} qty executed at ₹${matchedExecutionPrice.toFixed(2)}`,
          type: 'ORDER',
          severity: 'SUCCESS',
          data: {
            orderId: order.id,
            contractId: contract.id,
            tradingSymbol: contract.tradingSymbol,
            symbol: contract.symbol,
            strikePrice: Number(contract.strikePrice),
            optionType: contract.optionType,
            lotSize: contract.lotSize || 25,
            ltp: matchedExecutionPrice,
            price: matchedExecutionPrice,
            quantity: dto.quantity,
            orderType: dto.orderType,
            productType: dto.productType,
            transactionType: dto.transactionType,
            status: 'EXECUTED',
          },
        });
      }

      if (isExecutableNow) {
        // ── Wallet Update ──────────────────────────────────────────────────
        const actualTradePrice = matchedExecutionPrice;
        const actualTradePremium = Number((dto.quantity * actualTradePrice).toFixed(2));

        let newCashBalance = wallet.cashBalance;
        let newUtilized = wallet.utilizedMargin;
        let txnType: import('@trademitra/shared').WalletTxnType = 'ADJUSTMENT';
        let txnDirection: import('@trademitra/shared').WalletTxnDirection = 'DEBIT';
        let txnAmount = 0;
        let txnDesc = '';

        if (dto.transactionType === 'BUY') {
          if (isClosingShort) {
            // Buying back short: release SPAN margin, adjust cash with realized PnL
            const closingQty = Math.min(dto.quantity, Math.abs(existingPos?.netQuantity ?? 0));
            const closingLots = Math.ceil(closingQty / lotSize);
            const spanRelease = closingLots * OPTION_SELLING_MARGIN_PER_LOT;
            const avgSell = existingPos?.averageSellPrice ?? 0;
            const realizedPnl = Number((closingQty * (avgSell - actualTradePrice)).toFixed(2));
            newUtilized = Math.max(0, wallet.utilizedMargin - spanRelease);
            newCashBalance = wallet.cashBalance + realizedPnl;
            txnType = realizedPnl >= 0 ? 'SELL_CREDIT' : 'BUY_DEBIT';
            txnDirection = realizedPnl >= 0 ? 'CREDIT' : 'DEBIT';
            txnAmount = Math.abs(realizedPnl);
            txnDesc = `Buy-back ${closingQty} qty @ ₹${actualTradePrice.toFixed(2)} (short cover, P&L: ₹${realizedPnl.toFixed(2)}, SPAN ₹${spanRelease.toLocaleString('en-IN')} released)`;
          } else {
            // Fresh long: block premium in utilizedMargin (do not double-deduct from cashBalance)
            newCashBalance = wallet.cashBalance;
            newUtilized = wallet.utilizedMargin + actualTradePremium;
            txnType = 'BUY_DEBIT';
            txnDirection = 'DEBIT';
            txnAmount = actualTradePremium;
            txnDesc = `BUY ${dto.quantity} qty @ ₹${actualTradePrice.toFixed(2)} (premium blocked: ₹${actualTradePremium.toLocaleString('en-IN')})`;
          }
        } else {
          // SELL transaction
          if (isClosingLong) {
            // Selling long position: release utilized margin, adjust cash with realized PnL
            const closingQty = Math.min(dto.quantity, existingPos?.netQuantity ?? 0);
            const avgBuy = existingPos?.averageBuyPrice ?? 0;
            const closingBuyMargin = Number((closingQty * avgBuy).toFixed(2));
            const saleProceeds = Number((closingQty * actualTradePrice).toFixed(2));
            const realizedPnl = Number((saleProceeds - closingBuyMargin).toFixed(2));
            newUtilized = Math.max(0, wallet.utilizedMargin - closingBuyMargin);
            newCashBalance = wallet.cashBalance + realizedPnl;
            txnType = realizedPnl >= 0 ? 'SELL_CREDIT' : 'BUY_DEBIT';
            txnDirection = realizedPnl >= 0 ? 'CREDIT' : 'DEBIT';
            txnAmount = Math.abs(realizedPnl);
            txnDesc = `SELL ${closingQty} qty @ ₹${actualTradePrice.toFixed(2)} (long exit, P&L: ₹${realizedPnl.toFixed(2)}, margin ₹${closingBuyMargin.toLocaleString('en-IN')} released)`;
          } else {
            // Fresh short: block SPAN margin
            newCashBalance = wallet.cashBalance;
            newUtilized = wallet.utilizedMargin + requiredMargin;
            txnType = 'MARGIN_BLOCK';
            txnDirection = 'DEBIT';
            txnAmount = requiredMargin;
            txnDesc = `SELL ${dto.quantity} qty @ ₹${actualTradePrice.toFixed(2)} (SPAN margin blocked for short)`;
          }
        }

        const finalCash = Math.max(0, Number(newCashBalance.toFixed(2)));
        const finalUtilized = Math.max(0, Number(newUtilized.toFixed(2)));
        const newAvailable = Math.max(0, finalCash + wallet.pledgeMargin - finalUtilized);

        await this.walletRepo.updateWalletBalances(client, userId, finalCash, finalUtilized);

        // Record transaction in the ledger
        await this.walletRepo.recordTransaction(
          client,
          userId,
          txnType,
          txnDirection,
          txnAmount,
          newAvailable,
          txnDesc,
          order.id
        );

        // ── Position Update ────────────────────────────────────────────────
        const isFreshPosition = !existingPos || existingPos.status === 'CLOSED' || existingPos.netQuantity === 0;
        let netQty = isFreshPosition ? 0 : (existingPos.netQuantity ?? 0);
        let buyQty = isFreshPosition ? 0 : (existingPos.buyQuantity ?? 0);
        let sellQty = isFreshPosition ? 0 : (existingPos.sellQuantity ?? 0);
        let buyAmt = isFreshPosition ? 0 : (existingPos.buyAmount ?? 0);
        let sellAmt = isFreshPosition ? 0 : (existingPos.sellAmount ?? 0);
        let realizedPnl = isFreshPosition ? 0 : (existingPos.realizedPnl ?? 0);
        let avgBuy = isFreshPosition ? 0 : (existingPos.averageBuyPrice ?? 0);
        let avgSell = isFreshPosition ? 0 : (existingPos.averageSellPrice ?? 0);

        const thisPremium = Number((dto.quantity * actualTradePrice).toFixed(2));

        if (dto.transactionType === 'BUY') {
          if (netQty < 0) {
            // Closing a short position
            const closingQty = Math.min(dto.quantity, Math.abs(netQty));
            const pnl = closingQty * (avgSell - actualTradePrice);
            realizedPnl += pnl;
            avgBuy = actualTradePrice;
          }
          netQty += dto.quantity;
          buyQty += dto.quantity;
          buyAmt += thisPremium;
          avgBuy = buyQty > 0 ? Number((buyAmt / buyQty).toFixed(2)) : actualTradePrice;
        } else {
          // SELL transaction
          if (netQty > 0) {
            // Closing a long position
            const closingQty = Math.min(dto.quantity, netQty);
            const pnl = closingQty * (actualTradePrice - avgBuy);
            realizedPnl += pnl;
            avgSell = actualTradePrice; // Exact executed sell price
          }
          netQty -= dto.quantity;
          sellQty += dto.quantity;
          sellAmt += thisPremium;
          avgSell = (netQty === 0) ? actualTradePrice : (sellQty > 0 ? Number((sellAmt / sellQty).toFixed(2)) : actualTradePrice);
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
            tradingSymbol: contract.tradingSymbol,
            symbol: contract.symbol,
            strikePrice: contract.strikePrice,
            optionType: contract.optionType,
          });
        }
      } else {
        // For PENDING orders (LIMIT, SL, SL-M): Lock margin immediately so money cannot be double-spent
        if (requiredMargin > 0) {
          const pendingUtilized = Number((wallet.utilizedMargin + requiredMargin).toFixed(2));
          await this.walletRepo.updateWalletBalances(client, userId, wallet.cashBalance, pendingUtilized);
          await this.walletRepo.recordTransaction(
            client,
            userId,
            'MARGIN_BLOCK',
            'DEBIT',
            requiredMargin,
            Math.max(0, wallet.cashBalance + wallet.pledgeMargin - pendingUtilized),
            `Margin locked for PENDING ${dto.orderType} ${dto.transactionType} #${order.id}`,
            order.id
          );
        }
      }

      return order;
    };

    let createdOrder: OptionOrderEntity;
    try {
      createdOrder = await db.withTransaction((ctx) => executeOrderInTx(ctx.client));
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // Fallback execute
      createdOrder = await executeOrderInTx(null);
    }

    // Broadcast new order update event immediately to client
    this.feedProvider.emit('order:update', { userId, orderId: createdOrder.id });

    return createdOrder;
  }

  public async getUserOrders(userId: string, status?: string): Promise<OptionOrderEntity[]> {
    const orders = await this.ordersRepo.getOrdersByUserId(userId, status);
    
    // Enrich orders with live market contract details & tick LTP
    return Promise.all(
      orders.map(async (order) => {
        try {
          const contract = await this.contractsRepo.getContractById(order.contractId);
          const tradingSym = contract?.tradingSymbol || order.tradingSymbol;
          const tick = tradingSym ? this.feedProvider.getLatestTick(tradingSym) : null;
          return {
            ...order,
            tradingSymbol: tradingSym || order.tradingSymbol,
            strikePrice: contract?.strikePrice ?? order.strikePrice,
            optionType: contract?.optionType ?? order.optionType,
            symbol: contract?.symbol ?? order.symbol,
            ltp: tick?.ltp ?? order.ltp ?? contract?.strikePrice,
          };
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

    const contract = await this.contractsRepo.getContractById(existing.contractId);
    const tick = contract ? this.feedProvider.getLatestTick(contract.tradingSymbol) : null;
    const liveLtp = tick?.ltp ?? (existing.price || existing.averagePrice || 100);
    const existingPos = await this.positionsRepo.getPosition(userId, existing.contractId, existing.productType);

    const isLongTrade = existingPos
      ? (existingPos.netQuantity > 0 || (existingPos.netQuantity === 0 && existing.transactionType === 'BUY'))
      : (existing.transactionType === 'BUY' || (existing.triggerPrice !== undefined && existing.triggerPrice < liveLtp));

    if (isLongTrade) {
      if (dto.triggerPrice !== undefined && dto.triggerPrice > 0 && dto.triggerPrice >= liveLtp) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) must be strictly less than live LTP (₹${liveLtp.toFixed(2)}).`
        );
      }
      if (dto.targetPrice !== undefined && dto.targetPrice > 0 && dto.targetPrice <= liveLtp) {
        throw new ValidationError(
          `Target price (₹${dto.targetPrice.toFixed(2)}) must be strictly greater than live LTP (₹${liveLtp.toFixed(2)}).`
        );
      }
      if (dto.triggerPrice !== undefined && dto.targetPrice !== undefined && dto.triggerPrice > 0 && dto.targetPrice > 0 && dto.triggerPrice >= dto.targetPrice) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) must be strictly less than Target price (₹${dto.targetPrice.toFixed(2)}).`
        );
      }
    } else {
      // Short trade
      if (dto.triggerPrice !== undefined && dto.triggerPrice > 0 && dto.triggerPrice <= liveLtp) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) must be strictly greater than live LTP (₹${liveLtp.toFixed(2)}).`
        );
      }
      if (dto.targetPrice !== undefined && dto.targetPrice > 0 && dto.targetPrice >= liveLtp) {
        throw new ValidationError(
          `Target price (₹${dto.targetPrice.toFixed(2)}) must be strictly less than live LTP (₹${liveLtp.toFixed(2)}).`
        );
      }
      if (dto.triggerPrice !== undefined && dto.targetPrice !== undefined && dto.triggerPrice > 0 && dto.targetPrice > 0 && dto.triggerPrice <= dto.targetPrice) {
        throw new ValidationError(
          `Stop Loss price (₹${dto.triggerPrice.toFixed(2)}) must be strictly greater than Target price (₹${dto.targetPrice.toFixed(2)}).`
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

    // Broadcast modified order update to frontend immediately
    this.feedProvider.emit('order:update', { userId: updated.userId, orderId: updated.id });

    // Check if the modified order should trigger immediately against the latest market price
    if (contract) {
      const latestTick = this.feedProvider.getLatestTick(contract.tradingSymbol);
      if (latestTick) {
        await this.processTickForOrders(latestTick);
      }
    }

    return (await this.ordersRepo.getOrderById(orderId)) || updated;
  }

  public async cancelOrder(userId: string, orderId: string, reason = 'Cancelled by Trader'): Promise<OptionOrderEntity> {
    const existing = await this.ordersRepo.getOrderById(orderId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundError('Order not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ValidationError('Only PENDING orders can be cancelled.');
    }

    const updated = await this.ordersRepo.updateOrder(null, orderId, {
      status: 'CANCELLED',
      rejectionReason: reason,
    });

    if (!updated) throw new NotFoundError('Failed to cancel order.');

    // Release locked margin if this was a fresh opening pending order
    try {
      const contract = await this.contractsRepo.getContractById(existing.contractId);
      const existingPos = await this.positionsRepo.getPosition(userId, existing.contractId, existing.productType);
      const isClosing = (existing.transactionType === 'SELL' && (existingPos?.netQuantity ?? 0) > 0) ||
                        (existing.transactionType === 'BUY' && (existingPos?.netQuantity ?? 0) < 0);
      if (!isClosing) {
        const lotSize = contract?.lotSize || 25;
        const lots = Math.max(1, Math.round(existing.quantity / lotSize));
        const marginToRelease = existing.transactionType === 'BUY'
          ? Number((existing.quantity * (existing.price || existing.triggerPrice || 0)).toFixed(2))
          : Number((lots * OPTION_SELLING_MARGIN_PER_LOT).toFixed(2));
        if (marginToRelease > 0) {
          const wallet = await this.walletRepo.getWalletByUserId(userId);
          const newUtilized = Math.max(0, Number((wallet.utilizedMargin - marginToRelease).toFixed(2)));
          await this.walletRepo.updateWalletBalances(null, userId, wallet.cashBalance, newUtilized);
          await this.walletRepo.recordTransaction(
            null,
            userId,
            'MARGIN_RELEASE',
            'CREDIT',
            marginToRelease,
            Math.max(0, wallet.cashBalance + wallet.pledgeMargin - newUtilized),
            `Margin released on cancellation of order #${existing.id}`,
            existing.id
          );
        }
      }
    } catch (err) {
      logger.error(`Failed to release margin for cancelled order #${orderId}:`, err);
    }

    return updated;
  }

  public async cancelAllOrders(userId: string): Promise<OptionOrderEntity[]> {
    const pendingOrders = await this.ordersRepo.getOrdersByUserId(userId, 'PENDING');
    const cancelledOrders: OptionOrderEntity[] = [];
    for (const ord of pendingOrders) {
      try {
        const c = await this.cancelOrder(userId, ord.id, 'Bulk cancelled by Trader');
        cancelledOrders.push(c);
      } catch {
        // Continue cancelling others
      }
    }
    return cancelledOrders;
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
        if (order.status !== 'PENDING') continue;

        const contract = await this.contractsRepo.getContractById(order.contractId);
        if (!contract) continue;

        const symbolMatches =
          contract.tradingSymbol === tick.tradingSymbol ||
          contract.id === (tick as any).contractId ||
          contract.tradingSymbol?.replace(/[\s_]+/g, '').toUpperCase() === tick.tradingSymbol?.replace(/[\s_]+/g, '').toUpperCase();
        if (!symbolMatches) continue;

        const currentLtp = tick.ltp;

        // --- 1. TRAILING STOP LOSS LOGIC ---
        if (
          order.trailingStopLoss &&
          order.trailingStopLoss > 0 &&
          order.triggerPrice &&
          order.triggerPrice > 0
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

        // --- 2. STOP-LOSS, TARGET & LIMIT AUTO-EXECUTION LOGIC ---
        let shouldTrigger = false;
        let executionPrice = currentLtp;

        // (A) Check Stop-Loss Trigger (evaluated on ANY pending order that has triggerPrice set)
        if (order.triggerPrice && order.triggerPrice > 0) {
          // SELL SL (Stop Loss hit on price drop: currentLtp <= triggerPrice)
          if (order.transactionType === 'SELL' && currentLtp <= order.triggerPrice) {
            shouldTrigger = true;
            executionPrice = currentLtp;
            logger.info(`[StopLossEngine] SELL Stop Loss hit for Order #${order.id} (${contract.tradingSymbol}) at LTP ₹${currentLtp} <= SL Trigger ₹${order.triggerPrice}`);
          }
          // BUY SL (Stop Loss hit on price rise: currentLtp >= triggerPrice)
          else if (order.transactionType === 'BUY' && currentLtp >= order.triggerPrice) {
            shouldTrigger = true;
            executionPrice = currentLtp;
            logger.info(`[StopLossEngine] BUY Stop Loss hit for Order #${order.id} (${contract.tradingSymbol}) at LTP ₹${currentLtp} >= SL Trigger ₹${order.triggerPrice}`);
          }
        }

        // (B) Check Target Profit Exit (evaluated on ANY pending order that has targetPrice set)
        if (!shouldTrigger && order.targetPrice && order.targetPrice > 0) {
          // SELL Target (Target hit on price rise: currentLtp >= targetPrice)
          if (order.transactionType === 'SELL' && currentLtp >= order.targetPrice) {
            shouldTrigger = true;
            executionPrice = currentLtp;
            logger.info(`[TargetEngine] SELL Target hit for Order #${order.id} (${contract.tradingSymbol}) at LTP ₹${currentLtp} >= Target ₹${order.targetPrice}`);
          }
          // BUY Target (Short target hit on price drop: currentLtp <= targetPrice)
          else if (order.transactionType === 'BUY' && currentLtp <= order.targetPrice) {
            shouldTrigger = true;
            executionPrice = currentLtp;
            logger.info(`[TargetEngine] BUY Target hit for Order #${order.id} (${contract.tradingSymbol}) at LTP ₹${currentLtp} <= Target ₹${order.targetPrice}`);
          }
        }

        // (C) Standard LIMIT Order Check (only if no SL/Target triggered, and is a LIMIT order)
        if (!shouldTrigger && order.orderType === 'LIMIT' && order.price && order.price > 0) {
          if (order.transactionType === 'BUY' && currentLtp <= order.price) {
            shouldTrigger = true;
            executionPrice = order.price;
          } else if (order.transactionType === 'SELL' && currentLtp >= order.price) {
            shouldTrigger = true;
            executionPrice = order.price;
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

          // ── Settle wallet & position for auto-executed SL/Target/Limit orders ──
          const wallet = await this.walletRepo.getWalletByUserId(order.userId);
          if (wallet) {
            const SPAN_PER_LOT = 115000;
            const autoLotSize = contract.lotSize || 25;
            const autoLots = Math.max(1, Math.round(order.quantity / autoLotSize));

            let autoCash = wallet.cashBalance;
            let autoUtilized = wallet.utilizedMargin;
            let autoTxnType: import('@trademitra/shared').WalletTxnType = 'ADJUSTMENT';
            let autoTxnDir: import('@trademitra/shared').WalletTxnDirection = 'DEBIT';
            let autoTxnAmount = 0;
            let autoTxnDesc = '';

            const autoExistingPos = await this.positionsRepo.getPosition(
              order.userId, contract.id, order.productType
            );
            const autoNetQty = autoExistingPos?.netQuantity ?? 0;

            if (order.transactionType === 'SELL') {
              if (autoNetQty > 0) {
                // Closing a long position via SL/Target SELL
                const closingQty = Math.min(order.quantity, autoNetQty);
                const avgBuy = autoExistingPos?.averageBuyPrice ?? 0;
                const closingBuyMargin = Number((closingQty * avgBuy).toFixed(2));
                const saleProceeds = Number((closingQty * executionPrice).toFixed(2));
                const realizedPnl = Number((saleProceeds - closingBuyMargin).toFixed(2));
                autoUtilized = Math.max(0, wallet.utilizedMargin - closingBuyMargin);
                autoCash = wallet.cashBalance + realizedPnl;
                autoTxnType = realizedPnl >= 0 ? 'SELL_CREDIT' : 'BUY_DEBIT';
                autoTxnDir = realizedPnl >= 0 ? 'CREDIT' : 'DEBIT';
                autoTxnAmount = Math.abs(realizedPnl);
                autoTxnDesc = `Auto SELL ${closingQty} qty @ ₹${executionPrice.toFixed(2)} (${order.orderType} exit, P&L: ₹${realizedPnl.toFixed(2)}, margin ₹${closingBuyMargin.toLocaleString('en-IN')} released)`;
              } else {
                // Opening a short position via auto-execution — block SPAN margin
                const spanRequired = Number((autoLots * SPAN_PER_LOT).toFixed(2));
                autoCash = wallet.cashBalance;
                autoUtilized = wallet.utilizedMargin + spanRequired;
                autoTxnType = 'MARGIN_BLOCK';
                autoTxnDir = 'DEBIT';
                autoTxnAmount = spanRequired;
                autoTxnDesc = `Auto SELL ${order.quantity} qty @ ₹${executionPrice.toFixed(2)} (SPAN ₹${spanRequired.toLocaleString('en-IN')} blocked)`;
              }
            } else {
              // BUY auto-execution
              if (autoNetQty < 0) {
                // Closing a short position via SL/Target BUY
                const closingQty = Math.min(order.quantity, Math.abs(autoNetQty));
                const closingLots = Math.ceil(closingQty / autoLotSize);
                const spanRelease = closingLots * SPAN_PER_LOT;
                const avgSell = autoExistingPos?.averageSellPrice ?? 0;
                const realizedPnl = Number((closingQty * (avgSell - executionPrice)).toFixed(2));
                autoUtilized = Math.max(0, wallet.utilizedMargin - spanRelease);
                autoCash = wallet.cashBalance + realizedPnl;
                autoTxnType = realizedPnl >= 0 ? 'SELL_CREDIT' : 'BUY_DEBIT';
                autoTxnDir = realizedPnl >= 0 ? 'CREDIT' : 'DEBIT';
                autoTxnAmount = Math.abs(realizedPnl);
                autoTxnDesc = `Auto BUY ${closingQty} qty @ ₹${executionPrice.toFixed(2)} (${order.orderType} short cover, P&L: ₹${realizedPnl.toFixed(2)}, SPAN ₹${spanRelease.toLocaleString('en-IN')} released)`;
              } else {
                // Opening a fresh long via auto-executed LIMIT (margin was pre-locked at order.price upon creation)
                const preLocked = Number((order.quantity * (order.price || executionPrice)).toFixed(2));
                const actualTurnover = Number((order.quantity * executionPrice).toFixed(2));
                const diff = actualTurnover - preLocked;
                autoCash = wallet.cashBalance;
                autoUtilized = Math.max(0, Number((wallet.utilizedMargin + diff).toFixed(2)));
                autoTxnType = 'BUY_DEBIT';
                autoTxnDir = 'DEBIT';
                autoTxnAmount = actualTurnover;
                autoTxnDesc = `Auto BUY ${order.quantity} qty @ ₹${executionPrice.toFixed(2)} (LIMIT fill, trade active)`;
              }
            }

            const finalAutoCash = Math.max(0, Number(autoCash.toFixed(2)));
            const finalAutoUtilized = Math.max(0, Number(autoUtilized.toFixed(2)));
            const newAutoAvailable = Math.max(0, finalAutoCash + wallet.pledgeMargin - finalAutoUtilized);

            await this.walletRepo.updateWalletBalances(null, order.userId, finalAutoCash, finalAutoUtilized);

            // Record the auto-execution wallet event in the ledger
            await this.walletRepo.recordTransaction(
              null,
              order.userId,
              autoTxnType,
              autoTxnDir,
              autoTxnAmount,
              newAutoAvailable,
              autoTxnDesc,
              order.id
            );
          }

          const existingPos = await this.positionsRepo.getPosition(
            order.userId,
            contract.id,
            order.productType
          );

          const isFreshPosition = !existingPos || existingPos.status === 'CLOSED' || existingPos.netQuantity === 0;
          let netQty = isFreshPosition ? 0 : (existingPos.netQuantity ?? 0);
          let buyQty = isFreshPosition ? 0 : (existingPos.buyQuantity ?? 0);
          let sellQty = isFreshPosition ? 0 : (existingPos.sellQuantity ?? 0);
          let buyAmt = isFreshPosition ? 0 : (existingPos.buyAmount ?? 0);
          let sellAmt = isFreshPosition ? 0 : (existingPos.sellAmount ?? 0);
          let realizedPnl = isFreshPosition ? 0 : (existingPos.realizedPnl ?? 0);
          let avgBuy = isFreshPosition ? 0 : (existingPos.averageBuyPrice ?? 0);
          let avgSell = isFreshPosition ? 0 : (existingPos.averageSellPrice ?? 0);

          const autoPremium = Number((order.quantity * executionPrice).toFixed(2));

          if (order.transactionType === 'BUY') {
            if (netQty < 0) {
              const closingQty = Math.min(order.quantity, Math.abs(netQty));
              realizedPnl += closingQty * (avgSell - executionPrice);
              avgBuy = executionPrice;
            }
            netQty += order.quantity;
            buyQty += order.quantity;
            buyAmt += autoPremium;
            avgBuy = buyQty > 0 ? Number((buyAmt / buyQty).toFixed(2)) : executionPrice;
          } else {
            if (netQty > 0) {
              const closingQty = Math.min(order.quantity, netQty);
              realizedPnl += closingQty * (executionPrice - avgBuy);
              avgSell = executionPrice; // Exact executed sell price
            }
            netQty -= order.quantity;
            sellQty += order.quantity;
            sellAmt += autoPremium;
            avgSell = (netQty === 0) ? executionPrice : (sellQty > 0 ? Number((sellAmt / sellQty).toFixed(2)) : executionPrice);
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

          // Notification ONLY for successfully executed trades (Buy or Sell)
          const optTypeStr = contract.optionType === 'CE' ? 'Call' : 'Put';
          let expStr = '';
          try {
            const d = new Date(contract.expiryDate);
            const day = d.getDate();
            const monNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mon = monNames[d.getMonth()] || '';
            expStr = `${day} ${mon}`;
          } catch {
            expStr = '';
          }
          const friendlyName = `${contract.symbol} ${expStr} ${contract.strikePrice} ${optTypeStr}`.trim();
          const productStr = order.productType === 'MIS' ? 'intraday' : 'delivery';

          await this.notificationsService.notifyUser({
            userId: order.userId,
            title: 'Executed',
            message: `${friendlyName} , ${productStr} ${order.transactionType.toLowerCase()} order for ${order.quantity} qty executed at ₹${executionPrice.toFixed(2)}`,
            type: 'ORDER',
            severity: 'SUCCESS',
            data: {
              orderId: order.id,
              contractId: contract.id,
              tradingSymbol: contract.tradingSymbol,
              symbol: contract.symbol,
              strikePrice: Number(contract.strikePrice),
              optionType: contract.optionType,
              lotSize: contract.lotSize || 25,
              ltp: executionPrice,
              price: executionPrice,
              quantity: order.quantity,
              orderType: order.orderType,
              productType: order.productType,
              transactionType: order.transactionType,
              status: 'EXECUTED',
            },
          });

          // Broadcast order execution event
          this.feedProvider.emit('order:update', { userId: order.userId });
        }
      }
    } catch (err: any) {
      logger.error(`[OrderExecutionEngine] Error processing tick: ${err?.message}`);
    }
  }
}
