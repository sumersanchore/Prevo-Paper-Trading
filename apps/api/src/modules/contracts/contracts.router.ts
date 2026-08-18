import { Router } from 'express';
import { ContractsController } from './contracts.controller.js';

const router = Router();
const controller = new ContractsController();

/**
 * @openapi
 * /contracts/option-chain:
 *   get:
 *     summary: Fetch live Option Chain for a symbol (NIFTY/BANKNIFTY) with LTP, OI, and Spot Price
 *     tags:
 *       - Contracts
 *     parameters:
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *           default: NIFTY
 *     responses:
 *       200:
 *         description: Full Option Chain with CE and PE strikes.
 */
router.get('/option-chain', (req, res, next) => {
  controller.getOptionChain(req, res).catch(next);
});

/**
 * @openapi
 * /contracts:
 *   get:
 *     summary: List all active F&O contracts
 *     tags:
 *       - Contracts
 *     responses:
 *       200:
 *         description: List of options contracts.
 */
router.get('/', (req, res, next) => {
  controller.getContracts(req, res).catch(next);
});

export const contractsRouter: Router = router;
