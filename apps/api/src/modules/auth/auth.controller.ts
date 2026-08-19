import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type { RegisterDto, LoginDto } from './auth.dto.js';
import { UnauthorizedError } from '../../core/errors.js';

export class AuthController {
  private readonly service: AuthService;

  constructor(service = new AuthService()) {
    this.service = service;
  }

  public async register(req: Request, res: Response): Promise<void> {
    const dto: RegisterDto = req.body;
    const result = await this.service.register(dto);

    res.status(201).json({
      success: true,
      message: 'User registration successful. Paper trading account provisioned with ₹10,00,000.',
      data: result,
    });
  }

  public async login(req: Request, res: Response): Promise<void> {
    const dto: LoginDto = req.body;
    const result = await this.service.login(dto);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: result,
    });
  }

  public async googleLogin(req: Request, res: Response): Promise<void> {
    const dto = req.body;
    const result = await this.service.googleLogin(dto);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful.',
      data: result,
    });
  }

  public async sendEmailOtp(req: Request, res: Response): Promise<void> {
    const dto = req.body;
    const result = await this.service.sendEmailOtp(dto);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  public async verifyEmailOtp(req: Request, res: Response): Promise<void> {
    const dto = req.body;
    const result = await this.service.verifyEmailOtp(dto);

    res.status(200).json({
      success: true,
      message: 'Email OTP verification successful. Session authenticated.',
      data: result,
    });
  }

  public async me(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedError('User context not found in request.');
    }

    const result = await this.service.getProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  }
}
