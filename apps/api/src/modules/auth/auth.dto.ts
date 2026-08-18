import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Please provide a valid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(150),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const PlaceOrderSchema = z.object({
  contractId: z.string().min(1, 'Contract ID is required'),
  orderType: z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M'], {
    errorMap: () => ({ message: 'Order type must be one of MARKET, LIMIT, SL, SL-M' }),
  }),
  transactionType: z.enum(['BUY', 'SELL'], {
    errorMap: () => ({ message: 'Transaction type must be BUY or SELL' }),
  }),
  productType: z.enum(['NRML', 'MIS'], {
    errorMap: () => ({ message: 'Product type must be NRML or MIS' }),
  }),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  price: z.number().positive('Price must be greater than 0').optional(),
  triggerPrice: z.number().positive('Trigger price must be greater than 0').optional(),
  targetPrice: z.number().positive('Target price must be greater than 0').optional(),
  trailingStopLoss: z.number().positive('Trailing stop loss must be greater than 0').optional(),
  clientOrderId: z.string().uuid('Invalid clientOrderId UUID format').optional(),
}).refine((data) => {
  if (['LIMIT', 'SL'].includes(data.orderType) && (data.price === undefined || data.price <= 0)) {
    return false;
  }
  return true;
}, {
  message: 'Price is required for LIMIT and SL orders',
  path: ['price'],
}).refine((data) => {
  if (['SL', 'SL-M'].includes(data.orderType) && (data.triggerPrice === undefined || data.triggerPrice <= 0)) {
    return false;
  }
  return true;
}, {
  message: 'Trigger price is required for SL and SL-M orders',
  path: ['triggerPrice'],
});

export const ModifyOrderSchema = z.object({
  price: z.number().positive('Price must be greater than 0').optional(),
  triggerPrice: z.number().positive('Trigger price must be greater than 0').optional(),
  targetPrice: z.number().positive('Target price must be greater than 0').optional(),
  trailingStopLoss: z.number().positive('Trailing stop loss must be greater than 0').optional(),
  quantity: z.number().int().positive('Quantity must be a positive integer').optional(),
});

export type ModifyOrderDto = z.infer<typeof ModifyOrderSchema>;
