import { Router } from 'express';
import { WalletController } from './wallet.controller.js';

const router = Router();
const controller = new WalletController();

/**
 * @openapi
 * /wallet:
 *   get:
 *     summary: Get user paper wallet balances and margin
 *     tags:
 *       - Wallet
 *     responses:
 *       200:
 *         description: Wallet entity details.
 */
router.get('/', (req, res, next) => {
  controller.getWallet(req, res).catch(next);
});

/**
 * @openapi
 * /wallet/reset:
 *   post:
 *     summary: Reset paper trading wallet funds to initial ₹10,00,000
 *     tags:
 *       - Wallet
 *     responses:
 *       200:
 *         description: Wallet funds reset confirmation.
 */
router.post('/reset', (req, res, next) => {
  controller.resetWallet(req, res).catch(next);
});

export const walletRouter: Router = router;
