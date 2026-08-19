-- ------------------------------------------------------------------------------
-- 005_notifications.sql
-- Notification Table for Individual Order Updates & Common Broadcast Backup
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, -- NULL = Common broadcast for all users
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' CHECK (type IN ('ORDER', 'SYSTEM', 'PRICE_ALERT', 'WALLET', 'ANNOUNCEMENT')),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(created_at DESC) WHERE user_id IS NULL;
