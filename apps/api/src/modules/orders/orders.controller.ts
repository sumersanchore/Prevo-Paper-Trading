import type { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service.js';
import { ValidationError, NotFoundError } from '../../core/errors.js';
import type { PlaceOrderDto } from '@trademitra/shared';

export class OrdersController {
  private readonly service: OrdersService;

  constructor(service = new OrdersService()) {
    this.service = service;
  }

  public async placeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
      const dto: PlaceOrderDto = req.body;

      // ── Basic DTO validation ────────────────────────────────────────
      if (!dto.contractId) {
        throw new ValidationError('contractId is required.', { field: 'contractId' });
      }
      if (!dto.transactionType || !['BUY', 'SELL'].includes(dto.transactionType)) {
        throw new ValidationError('transactionType must be BUY or SELL.', { field: 'transactionType' });
      }
      if (!dto.orderType || !['MARKET', 'LIMIT', 'SL', 'SL-M'].includes(dto.orderType)) {
        throw new ValidationError('orderType must be MARKET, LIMIT, SL, or SL-M.', { field: 'orderType' });
      }
      if (!dto.quantity || dto.quantity <= 0) {
        throw new ValidationError('quantity must be a positive number.', { field: 'quantity' });
      }
      if (dto.orderType === 'LIMIT' && (!dto.price || dto.price <= 0)) {
        throw new ValidationError('A valid price is required for LIMIT orders.', { field: 'price' });
      }

      const order = await this.service.placeOrder(userId, dto);

      res.status(201).json({
        success: true,
        message: 'Order placed successfully.',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
      const status = req.query.status as string | undefined;
      const orders = await this.service.getUserOrders(userId, status);

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = String(req.params.id);
      const order = await this.service.getOrderById(orderId);

      if (!order) {
        throw new NotFoundError(`Order with id '${orderId}' not found.`);
      }

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  public async modifyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
      const orderId = String(req.params.id);
      const order = await this.service.modifyOrder(userId, orderId, req.body);

      res.status(200).json({
        success: true,
        message: 'Order modified successfully.',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  public async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
      const orderId = String(req.params.id);
      const order = await this.service.cancelOrder(userId, orderId);

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully.',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  public async cancelAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
      const orders = await this.service.cancelAllOrders(userId);

      res.status(200).json({
        success: true,
        message: `${orders.length} pending order(s) cancelled successfully.`,
        data: orders,
      });
    } catch (err) {
      next(err);
    }
  }
}
