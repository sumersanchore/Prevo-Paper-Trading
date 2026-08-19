import { db, type PoolClient } from '@trademitra/database';
import type {
  NotificationEntity,
  NotificationType,
  NotificationSeverity,
} from '@trademitra/shared';

interface INotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  is_read: boolean;
  data: any;
  created_at: Date | string;
}

export class NotificationsRepository {
  private static readonly memNotifications: NotificationEntity[] = [];
  private static isInitialized = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (NotificationsRepository.isInitialized) return;
    NotificationsRepository.isInitialized = true;

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id              BIGSERIAL PRIMARY KEY,
            user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
            title           VARCHAR(255) NOT NULL,
            message         TEXT NOT NULL,
            type            VARCHAR(30) NOT NULL DEFAULT 'ORDER',
            severity        VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
            is_read         BOOLEAN NOT NULL DEFAULT FALSE,
            data            JSONB DEFAULT '{}'::jsonb,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
      `);
    } catch (err: any) {
      console.warn('[NotificationsRepository] Table check warning:', err?.message);
    }
  }

  private mapRowToEntity(row: INotificationRow): NotificationEntity {
    return {
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : null,
      title: row.title,
      message: row.message,
      type: row.type,
      severity: row.severity,
      isRead: Boolean(row.is_read),
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {},
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  public async createNotification(
    client: PoolClient | null,
    dto: {
      userId?: string | null;
      title: string;
      message: string;
      type: NotificationType;
      severity: NotificationSeverity;
      data?: Record<string, any>;
    }
  ): Promise<NotificationEntity> {
    let safeUserId: number | null = null;
    if (dto.userId) {
      const parsed = parseInt(String(dto.userId), 10);
      safeUserId = isNaN(parsed) ? 1 : parsed;
    }

    const memoryEntity: NotificationEntity = {
      id: String(Date.now()),
      userId: dto.userId ? String(dto.userId) : null,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      severity: dto.severity,
      isRead: false,
      data: dto.data ?? {},
      createdAt: new Date().toISOString(),
    };

    const sql = `
      INSERT INTO notifications (user_id, title, message, type, severity, is_read, data)
      VALUES ($1, $2, $3, $4, $5, FALSE, $6)
      RETURNING id, user_id, title, message, type, severity, is_read, data, created_at
    `;

    const params = [
      safeUserId,
      dto.title,
      dto.message,
      dto.type,
      dto.severity,
      JSON.stringify(dto.data ?? {}),
    ];

    try {
      const runner: any = client ?? db;
      const { rows } = await runner.query(sql, params);
      if (rows && rows.length > 0) {
        const entity = this.mapRowToEntity(rows[0]!);
        NotificationsRepository.memNotifications.unshift(entity);
        return entity;
      }
    } catch (err: any) {
      console.warn('[NotificationsRepository] DB insertion fallback to memory:', err?.message);
    }

    NotificationsRepository.memNotifications.unshift(memoryEntity);
    return memoryEntity;
  }

  public async getNotifications(userId: string, limit = 50): Promise<NotificationEntity[]> {
    let safeUserId: number | null = null;
    if (userId) {
      const parsed = parseInt(String(userId), 10);
      safeUserId = isNaN(parsed) ? 1 : parsed;
    }

    try {
      const sql = `
        SELECT id, user_id, title, message, type, severity, is_read, data, created_at
        FROM notifications
        WHERE user_id = $1 OR user_id IS NULL
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const { rows } = await db.query<INotificationRow>(sql, [safeUserId, limit]);
      if (rows && rows.length > 0) {
        return rows.map((r) => this.mapRowToEntity(r));
      }
    } catch (err: any) {
      console.warn('[NotificationsRepository] DB query fallback to memory:', err?.message);
    }

    return NotificationsRepository.memNotifications
      .filter((n) => !n.userId || String(n.userId) === String(userId) || String(n.userId) === '1')
      .slice(0, limit);
  }

  public async markAsRead(userId: string, notificationId?: string): Promise<void> {
    let safeUserId: number | null = null;
    if (userId) {
      const parsed = parseInt(String(userId), 10);
      safeUserId = isNaN(parsed) ? 1 : parsed;
    }

    if (notificationId) {
      const sql = `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
      `;
      try {
        await db.query(sql, [notificationId, safeUserId]);
      } catch {}
      const item = NotificationsRepository.memNotifications.find((n) => n.id === notificationId);
      if (item) item.isRead = true;
    } else {
      const sql = `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1 OR user_id IS NULL
      `;
      try {
        await db.query(sql, [safeUserId]);
      } catch {}
      NotificationsRepository.memNotifications.forEach((n) => {
        if (!n.userId || String(n.userId) === String(userId) || String(n.userId) === '1') {
          n.isRead = true;
        }
      });
    }
  }
}
