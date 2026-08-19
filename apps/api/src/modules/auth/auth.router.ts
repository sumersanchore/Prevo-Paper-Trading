import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import {
  RegisterSchema,
  LoginSchema,
  GoogleAuthSchema,
  SendEmailOtpSchema,
  VerifyEmailOtpSchema,
} from './auth.dto.js';
import { validateBody } from '../../core/middlewares/validate.middleware.js';
import { authenticateJwt } from '../../core/middlewares/auth.middleware.js';

const router = Router();
const controller = new AuthController();

/**
 * @openapi
 * /auth/email-otp/send:
 *   post:
 *     summary: Send 6-digit OTP code to trader email
 *     tags:
 *       - Authentication
 */
router.post('/email-otp/send', validateBody(SendEmailOtpSchema), (req, res, next) => {
  controller.sendEmailOtp(req, res).catch(next);
});

/**
 * @openapi
 * /auth/email-otp/verify:
 *   post:
 *     summary: Verify 6-digit email OTP and issue JWT session token
 *     tags:
 *       - Authentication
 */
router.post('/email-otp/verify', validateBody(VerifyEmailOtpSchema), (req, res, next) => {
  controller.verifyEmailOtp(req, res).catch(next);
});

/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: Authenticate with Google OAuth & issue JWT Bearer token
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
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               googleId:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated via Google. Returns JWT token.
 */
router.post('/google', validateBody(GoogleAuthSchema), (req, res, next) => {
  controller.googleLogin(req, res).catch(next);
});

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
