-- ==============================================================================
-- TradeMitra - Enterprise PostgreSQL DDL Schema (v1.0.0)
-- Author: Sumer Kumar
-- Description: Core schema for users, wallets, option contracts, orders, and positions
-- Concurrency: BIGSERIAL primary keys, Row-level locking support, Precision numerics
-- ==============================================================================

-- Enable UUID extension for client order tracking
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auto-update timestamp trigger helper
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    auth_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    pan_masked VARCHAR(10),
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED' CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 2. WALLETS TABLE (Paper Trading Margin & Funds)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cash_balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00, -- Default ₹10 Lakhs paper funds
    pledge_margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    utilized_margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    version BIGINT NOT NULL DEFAULT 1, -- Optimistic concurrency token
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wallets_user_id UNIQUE (user_id),
    CONSTRAINT chk_positive_balance CHECK (cash_balance >= 0.00),
    CONSTRAINT chk_positive_utilized CHECK (utilized_margin >= 0.00)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 3. OPTIONS_CONTRACTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS options_contracts (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL, -- e.g. NIFTY, BANKNIFTY, FINNIFTY, RELIANCE
    trading_symbol VARCHAR(100) UNIQUE NOT NULL, -- e.g. NIFTY24DEC24500CE
    expiry_date DATE NOT NULL,
    strike_price NUMERIC(10, 2) NOT NULL,
    option_type VARCHAR(2) NOT NULL CHECK (option_type IN ('CE', 'PE')),
    lot_size INT NOT NULL CHECK (lot_size > 0),
    freeze_limit INT NOT NULL DEFAULT 1800,
    exchange VARCHAR(10) NOT NULL DEFAULT 'NFO',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_symbol_expiry_strike_type UNIQUE (symbol, expiry_date, strike_price, option_type)
);

CREATE INDEX IF NOT EXISTS idx_options_contracts_symbol_expiry ON options_contracts(symbol, expiry_date);
CREATE INDEX IF NOT EXISTS idx_options_contracts_trading_symbol ON options_contracts(trading_symbol);
CREATE INDEX IF NOT EXISTS idx_options_contracts_active ON options_contracts(is_active);

DROP TRIGGER IF EXISTS trg_options_contracts_updated_at ON options_contracts;
CREATE TRIGGER trg_options_contracts_updated_at
BEFORE UPDATE ON options_contracts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 4. OPTION_ORDERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS option_orders (
    id BIGSERIAL PRIMARY KEY,
    client_order_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contract_id BIGINT NOT NULL REFERENCES options_contracts(id) ON DELETE RESTRICT,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL', 'SL-M')),
    transaction_type VARCHAR(4) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    product_type VARCHAR(10) NOT NULL CHECK (product_type IN ('NRML', 'MIS')),
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2), -- Required for LIMIT, SL
    trigger_price NUMERIC(10, 2), -- Required for SL, SL-M
    trailing_stop_loss NUMERIC(10, 2), -- Trailing jump step / trail delta (e.g. ₹5.00)
    average_price NUMERIC(10, 2), -- Execution average price
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED')),
    rejection_reason TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_option_orders_user_status ON option_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_option_orders_contract_id ON option_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_option_orders_client_order_id ON option_orders(client_order_id);
CREATE INDEX IF NOT EXISTS idx_option_orders_created_at ON option_orders(created_at DESC);

DROP TRIGGER IF EXISTS trg_option_orders_updated_at ON option_orders;
CREATE TRIGGER trg_option_orders_updated_at
BEFORE UPDATE ON option_orders
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 5. OPTION_POSITIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS option_positions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contract_id BIGINT NOT NULL REFERENCES options_contracts(id) ON DELETE RESTRICT,
    product_type VARCHAR(10) NOT NULL CHECK (product_type IN ('NRML', 'MIS')),
    net_quantity INT NOT NULL DEFAULT 0,
    buy_quantity INT NOT NULL DEFAULT 0,
    sell_quantity INT NOT NULL DEFAULT 0,
    buy_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    sell_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    average_buy_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    average_sell_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    realized_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_contract_product UNIQUE (user_id, contract_id, product_type)
);

CREATE INDEX IF NOT EXISTS idx_option_positions_user_status ON option_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_option_positions_contract ON option_positions(contract_id);

DROP TRIGGER IF EXISTS trg_option_positions_updated_at ON option_positions;
CREATE TRIGGER trg_option_positions_updated_at
BEFORE UPDATE ON option_positions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();
