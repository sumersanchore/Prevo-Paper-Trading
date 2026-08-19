import { Router } from 'express';
import { OrdersController } from './orders.controller.js';
import { orderPlacementRateLimiter } from '../../http/middlewares/rate-limit.middleware.js';
import { validateBody } from '../../core/middlewares/validate.middleware.js';
import { PlaceOrderSchema, ModifyOrderSchema } from '../auth/auth.dto.js';

const router = Router();
const controller = new OrdersController();

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Place a new Option / Equity order (MARKET, LIMIT, SL, SL-M)
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractId
 *               - orderType
 *               - transactionType
 *               - productType
 *               - quantity
 *             properties:
 *               contractId:
 *                 type: string
 *               orderType:
 *                 type: string
 *                 enum: [MARKET, LIMIT, SL, SL-M]
 *               transactionType:
 *                 type: string
 *                 enum: [BUY, SELL]
 *               productType:
 *                 type: string
 *                 enum: [NRML, MIS]
 *               quantity:
 *                 type: integer
 *               price:
 *                 type: number
 *               triggerPrice:
 *                 type: number
 *               clientOrderId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Order created / executed.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 *       422:
 *         description: Insufficient margin.
 */
router.post('/', orderPlacementRateLimiter, validateBody(PlaceOrderSchema), (req, res, next) => {
  controller.placeOrder(req, res, next);
});

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: List user order history
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, EXECUTED, CANCELLED, REJECTED]
 *     responses:
 *       200:
 *         description: Array of orders.
 */
router.get('/', (req, res, next) => {
  controller.getOrders(req, res, next);
});

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Get single order details by ID
 *     tags:
 *       - Orders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details.
 */
router.get('/:id', (req, res, next) => {
  controller.getOrder(req, res, next);
});

/**
 * @openapi
 * /orders/{id}:
 *   put:
 *     summary: Modify a pending order (Price, Trigger Price, Quantity)
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:
 *                 type: number
 *               triggerPrice:
 *                 type: number
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Order modified successfully.
 */
router.put('/:id', validateBody(ModifyOrderSchema), (req, res, next) => {
  controller.modifyOrder(req, res, next);
});

/**
 * @openapi
 * /orders/cancel-all:
 *   delete:
 *     summary: Cancel all pending orders for user
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cancelled orders array.
 */
router.delete('/cancel-all', (req, res, next) => {
  controller.cancelAllOrders(req, res, next);
});

/**
 * @openapi
 * /orders/{id}:
 *   delete:
 *     summary: Cancel a single pending order
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully.
 */
router.delete('/:id', (req, res, next) => {
  controller.cancelOrder(req, res, next);
});

export const ordersRouter: Router = router;
