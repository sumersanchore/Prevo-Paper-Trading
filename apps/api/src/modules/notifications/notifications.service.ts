import { NotificationsRepository } from './notifications.repository.js';
import { McpFeedProvider } from '../../providers/mcp.provider.js';
import type {
  NotificationEntity,
  NotificationType,
  NotificationSeverity,
} from '@trademitra/shared';
import { logger } from '../../core/logger.js';

export class NotificationsService {
  private readonly notificationsRepo: NotificationsRepository;
  private readonly feedProvider: McpFeedProvider;

  constructor(
    notificationsRepo = new NotificationsRepository(),
    feedProvider = McpFeedProvider.getInstance()
  ) {
    this.notificationsRepo = notificationsRepo;
    this.feedProvider = feedProvider;
  }

  public async notifyUser(dto: {
    userId?: string | null;
    title: string;
    message: string;
    type?: NotificationType;
    severity?: NotificationSeverity;
    data?: Record<string, any>;
  }): Promise<NotificationEntity> {
    const type = dto.type ?? 'SYSTEM';
    const severity = dto.severity ?? 'INFO';

    const entity = await this.notificationsRepo.createNotification(null, {
      userId: dto.userId ?? null,
      title: dto.title,
      message: dto.message,
      type,
      severity,
      data: dto.data ?? {},
    });

    // Real-time Push via WebSocket / Event Emitter
    this.feedProvider.emit('notification:new', entity);

    logger.info(
      `[Notifications] ${dto.userId ? `User #${dto.userId}` : 'BROADCAST'} [${type}/${severity}]: ${dto.title}`
    );

    return entity;
  }

  public async getUserNotifications(userId: string): Promise<NotificationEntity[]> {
    return this.notificationsRepo.getNotifications(userId);
  }

  public async markAsRead(userId: string, notificationId?: string): Promise<void> {
    await this.notificationsRepo.markAsRead(userId, notificationId);
  }

  public async broadcastSystemAnnouncement(
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<NotificationEntity> {
    return this.notifyUser({
      userId: null, // Broadcast to all users
      title,
      message,
      type: 'ANNOUNCEMENT',
      severity: 'INFO',
      data: { ...data, broadcast: true },
    });
  }
}
