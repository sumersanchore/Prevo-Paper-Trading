import type { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service.js';

export class NotificationsController {
  private readonly notificationsService: NotificationsService;

  constructor(notificationsService = new NotificationsService()) {
    this.notificationsService = notificationsService;
  }

  public getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || '1';
      const notifications = await this.notificationsService.getUserNotifications(userId);
      res.json({
        success: true,
        data: notifications,
      });
    } catch (err) {
      next(err);
    }
  };

  public markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || '1';
      const { notificationId } = req.body;
      await this.notificationsService.markAsRead(userId, notificationId);
      res.json({
        success: true,
        message: 'Notifications marked as read.',
      });
    } catch (err) {
      next(err);
    }
  };

  public broadcast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, message, data } = req.body;
      const entity = await this.notificationsService.broadcastSystemAnnouncement(title, message, data);
      res.json({
        success: true,
        data: entity,
      });
    } catch (err) {
      next(err);
    }
  };
}
