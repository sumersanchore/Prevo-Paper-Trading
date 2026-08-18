export enum OptionType {
  CE = 'CE',
  PE = 'PE',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  SL = 'SL',
  SL_M = 'SL-M',
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum ProductType {
  NRML = 'NRML',
  MIS = 'MIS',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum Exchange {
  NSE = 'NSE',
  NFO = 'NFO',
  BSE = 'BSE',
  MCX = 'MCX',
}

export enum KycStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}
