import { Router } from 'express';
import { PositionsController } from './positions.controller.js';

const router = Router();
const controller = new PositionsController();

/**
 * @openapi
 * /positions:
 *   get:
 *     summary: Fetch active and closed trading positions with live P&L
 *     tags:
 *       - Positions
 *     responses:
 *       200:
 *         description: Positions summary with total realized and unrealized P&L.
 */
router.get('/', (req, res, next) => {
  controller.getPositions(req, res).catch(next);
});

export const positionsRouter: Router = router;
