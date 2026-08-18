import type { Request, Response } from 'express';
import { OrdersService } from './orders.service.js';
import type { PlaceOrderDto } from '@trademitra/shared';

export class OrdersController {
  private readonly service: OrdersService;

  constructor(service = new OrdersService()) {
    this.service = service;
  }

  public async placeOrder(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const dto: PlaceOrderDto = req.body;
    const order = await this.service.placeOrder(userId, dto);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      data: order,
    });
  }

  public async getOrders(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const status = req.query.status as string | undefined;
    const orders = await this.service.getUserOrders(userId, status);

    res.status(200).json({
      success: true,
      data: orders,
    });
  }

  public async getOrder(req: Request, res: Response): Promise<void> {
    const orderId = String(req.params.id);
    const order = await this.service.getOrderById(orderId);

    res.status(200).json({
      success: true,
      data: order,
    });
  }

  public async modifyOrder(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const orderId = String(req.params.id);
    const order = await this.service.modifyOrder(userId, orderId, req.body);

    res.status(200).json({
      success: true,
      message: 'Order modified successfully.',
      data: order,
    });
  }

  public async cancelOrder(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const orderId = String(req.params.id);
    const order = await this.service.cancelOrder(userId, orderId);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: order,
    });
  }

  public async cancelAllOrders(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id || (req.headers['x-user-id'] as string) || '1';
    const orders = await this.service.cancelAllOrders(userId);

    res.status(200).json({
      success: true,
      message: `${orders.length} pending order(s) cancelled successfully.`,
      data: orders,
    });
  }
}
