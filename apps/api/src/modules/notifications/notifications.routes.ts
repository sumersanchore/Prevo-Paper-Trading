import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';

const router = Router();
const controller = new NotificationsController();

router.get('/', controller.getNotifications);
router.post('/mark-read', controller.markAsRead);
router.post('/broadcast', controller.broadcast);

export const notificationsRouter = router;
