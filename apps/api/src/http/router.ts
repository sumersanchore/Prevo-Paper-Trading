import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.router.js';
import { healthRouter } from '../modules/health/health.router.js';
import { walletRouter } from '../modules/wallet/wallet.router.js';
import { contractsRouter } from '../modules/contracts/contracts.router.js';
import { ordersRouter } from '../modules/orders/orders.router.js';
import { positionsRouter } from '../modules/positions/positions.router.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { authenticateJwt } from '../core/middlewares/auth.middleware.js';

const router = Router();

// Public Routes
router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/contracts', contractsRouter);

// Protected Trading Routes (Require Bearer JWT)
router.use('/wallet', authenticateJwt, walletRouter);
router.use('/orders', authenticateJwt, ordersRouter);
router.use('/positions', authenticateJwt, positionsRouter);
router.use('/notifications', authenticateJwt, notificationsRouter);

export const mainRouter: Router = router;
