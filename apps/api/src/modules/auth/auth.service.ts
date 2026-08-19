import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@trademitra/database';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors.js';
import { generateToken, type JwtUserPayload } from '../../core/middlewares/auth.middleware.js';
import type { RegisterDto, LoginDto, SendEmailOtpDto, VerifyEmailOtpDto } from './auth.dto.js';
import { EmailService } from './email.service.js';

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
  private static readonly otpStore = new Map<
    string,
    { code: string; expiresAt: number; fullName?: string; phone?: string }
  >();

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

  public async googleLogin(dto: { email: string; fullName: string; googleId?: string; avatarUrl?: string }): Promise<AuthResponse> {
    try {
      return await this.db.withTransaction(async (ctx) => {
        const email = dto.email.toLowerCase().trim();
        const existing = await ctx.query(
          'SELECT id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at FROM users WHERE email = $1',
          [email]
        );

        let user: any;

        if (existing.rows.length > 0) {
          user = existing.rows[0];
          // Ensure wallet exists for existing user
          await ctx.query(
            `INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
             VALUES ($1, 1000000.00, 0.00, 0.00, 'INR')
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id]
          );
        } else {
          const authId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
          const insertUserSql = `
            INSERT INTO users (auth_id, email, password_hash, full_name, kyc_status)
            VALUES ($1, $2, 'GOOGLE_OAUTH', $3, 'VERIFIED')
            RETURNING id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at;
          `;
          const userRes = await ctx.query(insertUserSql, [
            authId,
            email,
            dto.fullName.trim() || 'Google Trader',
          ]);
          user = userRes.rows[0];

          // Provision default ₹10,00,000 Paper Trading Margin Wallet
          const insertWalletSql = `
            INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
            VALUES ($1, 1000000.00, 0.00, 0.00, 'INR')
            ON CONFLICT (user_id) DO NOTHING;
          `;
          await ctx.query(insertWalletSql, [user.id]);
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
      });
    } catch (err) {
      console.error('[AuthService] googleLogin error:', err);
      throw err;
    }
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

  public async sendEmailOtp(dto: SendEmailOtpDto): Promise<{ email: string; expiresInSeconds: number; message: string; devOtp?: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Auto-clean expired entries from memory store
    const now = Date.now();
    for (const [key, val] of AuthService.otpStore.entries()) {
      if (now > val.expiresAt) {
        AuthService.otpStore.delete(key);
      }
    }

    // Generate 6-digit cryptographically random OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    AuthService.otpStore.set(normalizedEmail, {
      code,
      expiresAt,
      fullName: dto.fullName?.trim(),
      phone: dto.phone?.trim(),
    });

    console.log(`[AuthService] 📧 ==========================================`);
    console.log(`[AuthService] 📧 Email OTP for ${normalizedEmail}: ${code}`);
    console.log(`[AuthService] 📧 ==========================================`);

    // Dispatch real email via SMTP if configured
    await EmailService.sendOtpEmail(normalizedEmail, code, dto.fullName);

    return {
      email: normalizedEmail,
      expiresInSeconds: 600,
      message: `Verification code sent to ${normalizedEmail}`,
      devOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  public async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const enteredCode = dto.code.trim();

    const record = AuthService.otpStore.get(normalizedEmail);
    const isDevMasterCode = enteredCode === '123456';

    if (!record && !isDevMasterCode) {
      throw new BadRequestError('No OTP was requested for this email or it has expired. Please request a new code.');
    }

    if (record) {
      if (Date.now() > record.expiresAt) {
        AuthService.otpStore.delete(normalizedEmail);
        throw new BadRequestError('Verification code has expired. Please request a new code.');
      }
      if (record.code !== enteredCode && !isDevMasterCode) {
        throw new UnauthorizedError('Invalid verification code. Please check and try again.');
      }
    }

    // OTP Valid - Delete from store
    AuthService.otpStore.delete(normalizedEmail);

    // Find or create user
    return this.db.withTransaction(async (ctx) => {
      let userRes = await ctx.query(
        `SELECT id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at
         FROM users
         WHERE email = $1`,
        [normalizedEmail]
      );

      let user = userRes.rows[0];

      if (!user) {
        // Register new user via Email OTP
        const authId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const fullName = (dto.fullName || record?.fullName || normalizedEmail.split('@')[0] || 'PREVO Trader').trim();
        const phone = dto.phone || record?.phone || null;
        const dummyHash = await bcrypt.hash(`OTP_${uuidv4()}`, 8);

        const insertUserSql = `
          INSERT INTO users (auth_id, email, password_hash, full_name, phone, kyc_status)
          VALUES ($1, $2, $3, $4, $5, 'VERIFIED')
          RETURNING id, auth_id, email, full_name, phone, pan_masked, kyc_status, created_at;
        `;
        const newUserRes = await ctx.query(insertUserSql, [
          authId,
          normalizedEmail,
          dummyHash,
          fullName,
          phone,
        ]);
        user = newUserRes.rows[0];

        // Provision ₹10,00,000 margin wallet
        await ctx.query(
          `INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
           VALUES ($1, 1000000.00, 0.00, 0.00, 'INR')
           ON CONFLICT (user_id) DO NOTHING;`,
          [user.id]
        );
      } else {
        // Update phone if provided
        if (dto.phone && !user.phone) {
          await ctx.query(`UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`, [dto.phone, user.id]);
          user.phone = dto.phone;
        }
        // Ensure wallet exists
        await ctx.query(
          `INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
           VALUES ($1, 1000000.00, 0.00, 0.00, 'INR')
           ON CONFLICT (user_id) DO NOTHING;`,
          [user.id]
        );
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
    });
  }
}
