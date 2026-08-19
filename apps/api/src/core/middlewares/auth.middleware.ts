import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.config.js';
import { UnauthorizedError } from '../errors.js';

export interface JwtUserPayload {
  id: string;
  email: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function generateToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtUserPayload {
  return jwt.verify(token, config.jwt.secret) as JwtUserPayload;
}

export function authenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
        return next();
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          return next(new UnauthorizedError('JWT access token has expired. Please log in again.'));
        }
        // In development, proceed with fallback if token is invalid
        if (config.env === 'production') {
          return next(new UnauthorizedError('Invalid or corrupted JWT access token.'));
        }
      }
    }
  }

  // Development / Paper Trading Fallback: support x-user-id or default user #1
  const devUserId = (req.headers['x-user-id'] as string) || '1';
  req.user = {
    id: devUserId,
    email: 'sumer@trademitra.com',
    fullName: 'Sumer Kumar',
  };
  return next();
}

export function optionalAuthJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        req.user = verifyToken(token);
      } catch {
        // Ignore errors for optional authentication
      }
    }
  }
  next();
}
