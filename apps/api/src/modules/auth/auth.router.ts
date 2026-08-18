import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { RegisterSchema, LoginSchema } from './auth.dto.js';
import { validateBody } from '../../core/middlewares/validate.middleware.js';
import { authenticateJwt } from '../../core/middlewares/auth.middleware.js';

const router = Router();
const controller = new AuthController();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new trader account
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: trader@trademitra.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: TradeStrong@2026
 *               fullName:
 *                 type: string
 *                 example: Sumer Kumar
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *     responses:
 *       201:
 *         description: Account successfully registered and paper trading wallet provisioned.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: User already exists.
 */
router.post('/register', validateBody(RegisterSchema), (req, res, next) => {
  controller.register(req, res).catch(next);
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user & issue JWT Bearer token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sumer.kumar@trademitra.local
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *     responses:
 *       200:
 *         description: Successfully authenticated. Returns JWT token.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', validateBody(LoginSchema), (req, res, next) => {
  controller.login(req, res).catch(next);
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated trader profile & wallet summary
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile and wallet margins.
 *       401:
 *         description: Missing or invalid JWT token.
 */
router.get('/me', authenticateJwt, (req, res, next) => {
  controller.me(req, res).catch(next);
});

export const authRouter: Router = router;
