import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@trademitra/database';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors.js';
import { generateToken, type JwtUserPayload } from '../../core/middlewares/auth.middleware.js';
import type { RegisterDto, LoginDto } from './auth.dto.js';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    authId: string;
    email: string;
    fullName: string;
    phone?: string;
    panMasked?: string;
    kycStatus: string;
    createdAt: string;
  };
}

export class AuthService {
  private readonly db = db;

  public async register(dto: RegisterDto): Promise<AuthResponse> {
    return this.db.withTransaction(async (ctx) => {
      // Check if user already exists
      const existing = await ctx.query(
        'SELECT id FROM users WHERE email = $1',
        [dto.email.toLowerCase().trim()]
      );
      if (existing.rows.length > 0) {
        throw new ConflictError('A user with this email address already exists.');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(dto.password, saltRounds);
      const authId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

      // Insert User
      const insertUserSql = `
        INSERT INTO users (auth_id, email, password_hash, full_name, phone, kyc_status)
        VALUES ($1, $2, $3, $4, $5, 'VERIFIED')
        RETURNING id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at;
      `;
      const userRes = await ctx.query(insertUserSql, [
        authId,
        dto.email.toLowerCase().trim(),
        passwordHash,
        dto.fullName.trim(),
        dto.phone ?? null,
      ]);
      const user = userRes.rows[0];

      // Provision default ₹10,00,000 Paper Trading Margin Wallet
      const insertWalletSql = `
        INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
        VALUES ($1, 1000000.00, 0.00, 0.00, 'INR');
      `;
      await ctx.query(insertWalletSql, [user.id]);

      const payload: JwtUserPayload = {
        id: String(user.id),
        email: user.email,
        fullName: user.full_name,
      };
      const token = generateToken(payload);

      return {
        token,
        user: {
          id: String(user.id),
          authId: user.auth_id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          panMasked: user.pan_masked,
          kycStatus: user.kyc_status,
          createdAt: user.created_at,
        },
      };
    });
  }

  public async login(dto: LoginDto): Promise<AuthResponse> {
    const result = await this.db.query(
      `SELECT id, auth_id, email, password_hash, full_name, phone, pan_masked, kyc_status, created_at
       FROM users
       WHERE email = $1`,
      [dto.email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password credentials.');
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      throw new UnauthorizedError('Account requires password setup or reset.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password credentials.');
    }

    const payload: JwtUserPayload = {
      id: String(user.id),
      email: user.email,
      fullName: user.full_name,
    };
    const token = generateToken(payload);

    return {
      token,
      user: {
        id: String(user.id),
        authId: user.auth_id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        panMasked: user.pan_masked,
        kycStatus: user.kyc_status,
        createdAt: user.created_at,
      },
    };
  }

  public async getProfile(userId: string): Promise<any> {
    const userRes = await this.db.query(
      `SELECT id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundError('User profile not found.');
    }

    const walletRes = await this.db.query(
      `SELECT id, cash_balance, pledge_margin, utilized_margin, currency
       FROM wallets
       WHERE user_id = $1`,
      [userId]
    );

    const user = userRes.rows[0];
    const wallet = walletRes.rows[0] ?? null;

    return {
      user: {
        id: String(user.id),
        authId: user.auth_id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        panMasked: user.pan_masked,
        kycStatus: user.kyc_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      wallet: wallet
        ? {
            id: String(wallet.id),
            cashBalance: parseFloat(wallet.cash_balance),
            pledgeMargin: parseFloat(wallet.pledge_margin),
            utilizedMargin: parseFloat(wallet.utilized_margin),
            availableMargin: parseFloat(wallet.cash_balance) + parseFloat(wallet.pledge_margin) - parseFloat(wallet.utilized_margin),
            currency: wallet.currency,
          }
        : null,
    };
  }
}
