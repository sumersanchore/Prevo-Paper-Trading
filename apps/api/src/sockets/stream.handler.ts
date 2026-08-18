import type { Server, Socket } from 'socket.io';
import { logger } from '../core/logger.js';
import { McpFeedProvider, type MarketIndexData } from '../providers/mcp.provider.js';
import { OrdersService } from '../modules/orders/orders.service.js';
import type { LiveTickData } from '@trademitra/shared';

export class SocketStreamHandler {
  private readonly io: Server;
  private readonly feedProvider: McpFeedProvider;
  private readonly ordersService: OrdersService;

  constructor(io: Server) {
    this.io = io;
    this.feedProvider = McpFeedProvider.getInstance();
    this.ordersService = new OrdersService();
    this.initSocketEvents();
    this.initFeedListeners();
  }

  private initSocketEvents(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`[SocketStream] Client connected: ${socket.id}`);

      // Send initial snapshot of market indices
      const indices = this.feedProvider.getIndices();
      socket.emit('indices:snapshot', indices);

      // Send initial snapshot of all option ticks
      const ticks = this.feedProvider.getAllTicks();
      socket.emit('ticks:snapshot', ticks);

      // Room subscriptions
      socket.on('subscribe:symbol', (symbol: string) => {
        socket.join(`symbol:${symbol}`);
        logger.debug(`[SocketStream] Client ${socket.id} subscribed to symbol:${symbol}`);
      });

      socket.on('unsubscribe:symbol', (symbol: string) => {
        socket.leave(`symbol:${symbol}`);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`[SocketStream] Client disconnected: ${socket.id} (Reason: ${reason})`);
      });
    });
  }

  private initFeedListeners(): void {
    this.feedProvider.on('index_tick', (indexData: MarketIndexData) => {
      this.io.emit('index:tick', indexData);
    });

    this.feedProvider.on('contract_ticks_batch', (batch: LiveTickData[]) => {
      this.io.emit('ticks:batch', batch);
      // Fast sub-millisecond asynchronous matching for active pending orders
      if (batch.length > 0) {
        Promise.all(batch.map((t) => this.ordersService.processTickForOrders(t))).catch((err) => {
          logger.error(`[SocketStream] Error in batch tick matching: ${err?.message}`);
        });
      }
    });

    this.feedProvider.on('contract_tick', (tickData: LiveTickData) => {
      this.io.emit('tick:update', tickData);
      this.io.to(`symbol:${tickData.tradingSymbol}`).emit('tick:update', tickData);
      // Real-time Stop-Loss and Trailing Engine evaluation
      this.ordersService.processTickForOrders(tickData).catch((err) => {
        logger.error(`[SocketStream] Error processing live tick matching: ${err?.message}`);
      });
    });

    this.feedProvider.on('order:update', (data: any) => {
      this.io.emit('order:update', data);
    });
  }

  public broadcastOrderUpdate(userId: string, orderData: any): void {
    this.io.emit(`user:${userId}:order`, orderData);
  }

  public broadcastPositionUpdate(userId: string, positionData: any): void {
    this.io.emit(`user:${userId}:position`, positionData);
  }
}
