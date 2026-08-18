import { Router } from 'express';
import { HealthController } from './health.controller.js';

const router = Router();
const controller = new HealthController();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: System and Database Health Check
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System health status and pool statistics.
 */
router.get('/', (req, res, next) => {
  controller.getHealth(req, res).catch(next);
});

export const healthRouter: Router = router;
