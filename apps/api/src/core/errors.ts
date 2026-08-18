export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: any) {
    super(message, 404, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details?: any) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden request', details?: any) {
    super(message, 403, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 400, details);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = 'Insufficient margin available for this trade', details?: any) {
    super(message, 422, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or concurrent update error', details?: any) {
    super(message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please slow down', details?: any) {
    super(message, 429, details);
  }
}
