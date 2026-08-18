export * from './enums/index.js';

export interface UserEntity {
  id: string; // BIGINT represented as string in JS to avoid precision truncation
  authId: string;
  email: string;
  fullName: string;
  phone?: string;
  panMasked?: string;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletEntity {
  id: string;
  userId: string;
  cashBalance: number;
  pledgeMargin: number;
  utilizedMargin: number;
  availableMargin: number;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OptionsContractEntity {
  id: string;
  symbol: string;
  tradingSymbol: string;
  expiryDate: string;
  strikePrice: number;
  optionType: 'CE' | 'PE';
  lotSize: number;
  freezeLimit: number;
  exchange: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OptionOrderEntity {
  id: string;
  clientOrderId: string;
  userId: string;
  contractId: string;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  transactionType: 'BUY' | 'SELL';
  productType: 'NRML' | 'MIS';
  quantity: number;
  price?: number;
  triggerPrice?: number;
  targetPrice?: number;
  trailingStopLoss?: number;
  averagePrice?: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  rejectionReason?: string;
  executedAt?: string;
  tradingSymbol?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  symbol?: string;
  ltp?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OptionPositionEntity {
  id: string;
  userId: string;
  contractId: string;
  productType: 'NRML' | 'MIS';
  netQuantity: number;
  buyQuantity: number;
  sellQuantity: number;
  buyAmount: number;
  sellAmount: number;
  averageBuyPrice: number;
  averageSellPrice: number;
  realizedPnl: number;
  unrealizedPnl?: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderDto {
  contractId: string;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  transactionType: 'BUY' | 'SELL';
  productType: 'NRML' | 'MIS';
  quantity: number;
  price?: number;
  triggerPrice?: number;
  targetPrice?: number;
  trailingStopLoss?: number;
  clientOrderId?: string;
}

export interface ModifyOrderDto {
  price?: number;
  triggerPrice?: number;
  targetPrice?: number;
  trailingStopLoss?: number;
  quantity?: number;
}


export interface LiveTickData {
  symbol: string;
  tradingSymbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  change: number;
  pChange: number;
  timestamp: string;
}

export interface OptionChainStrikeItem {
  strikePrice: number;
  ce?: {
    contractId: string;
    tradingSymbol: string;
    ltp: number;
    change: number;
    pChange: number;
    oi: number;
    volume: number;
    iv?: number;
  };
  pe?: {
    contractId: string;
    tradingSymbol: string;
    ltp: number;
    change: number;
    pChange: number;
    oi: number;
    volume: number;
    iv?: number;
  };
}
