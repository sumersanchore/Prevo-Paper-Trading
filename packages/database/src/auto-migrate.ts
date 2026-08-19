import { PostgresProvider } from './postgres.provider.js';

export interface MigrationStep {
  version: string;
  name: string;
  sql: string;
}

const MIGRATIONS: MigrationStep[] = [
  {
    version: '001_initial_schema',
    name: 'Core DDL Schema (Users, Wallets, Contracts, Orders, Positions)',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE OR REPLACE FUNCTION update_timestamp_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

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

      CREATE TABLE IF NOT EXISTS wallets (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          cash_balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
          pledge_margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          utilized_margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          currency VARCHAR(5) NOT NULL DEFAULT 'INR',
          version BIGINT NOT NULL DEFAULT 1,
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

      CREATE TABLE IF NOT EXISTS options_contracts (
          id BIGSERIAL PRIMARY KEY,
          symbol VARCHAR(30) NOT NULL,
          trading_symbol VARCHAR(100) UNIQUE NOT NULL,
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

      CREATE TABLE IF NOT EXISTS option_orders (
          id BIGSERIAL PRIMARY KEY,
          client_order_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          contract_id BIGINT NOT NULL REFERENCES options_contracts(id) ON DELETE RESTRICT,
          order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL', 'SL-M')),
          transaction_type VARCHAR(4) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
          product_type VARCHAR(10) NOT NULL CHECK (product_type IN ('NRML', 'MIS')),
          quantity INT NOT NULL CHECK (quantity > 0),
          price NUMERIC(10, 2),
          trigger_price NUMERIC(10, 2),
          target_price NUMERIC(10, 2),
          trailing_stop_loss NUMERIC(10, 2),
          average_price NUMERIC(10, 2),
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
    `,
  },
  {
    version: '002_seed_mock_data',
    name: 'Seed Initial Demo User, ₹10 Lakhs Wallet & Weekly Options Contracts',
    sql: `
      INSERT INTO users (auth_id, email, password_hash, full_name, phone, pan_masked, kyc_status)
      VALUES 
          ('usr_sumer_001', 'sumer.kumar@trademitra.local', '$2b$10$a8SRLLgkab/FE/frGeUyCunYsfHwsma8WESXz6mxVDlCvpa1uhgO.', 'Sumer Kumar', '+919876543210', 'ABCDE1234F', 'VERIFIED')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

      INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
      SELECT id, 1000000.00, 0.00, 0.00, 'INR'
      FROM users
      WHERE email = 'sumer.kumar@trademitra.local'
      ON CONFLICT (user_id) DO NOTHING;

      DO $$
      DECLARE
          strike INT;
          nifty_strikes INT[] := ARRAY[23900, 23950, 24000, 24050, 24100, 24150, 24200, 24250, 24300, 24350, 24400, 24450, 24500];
          bank_strikes INT[] := ARRAY[57000, 57100, 57200, 57300, 57400, 57500, 57600];
          expiries RECORD;
      BEGIN
          CREATE TEMP TABLE IF NOT EXISTS temp_expiries (date DATE, code VARCHAR);
          TRUNCATE temp_expiries;
          INSERT INTO temp_expiries VALUES 
              ('2026-08-20', '20AUG'),
              ('2026-08-25', '25AUG'),
              ('2026-09-01', '01SEP'),
              ('2026-09-08', '08SEP'),
              ('2026-09-15', '15SEP'),
              ('2026-09-22', '22SEP'),
              ('2026-09-29', '29SEP'),
              ('2026-10-27', '27OCT'),
              ('2026-11-24', '24NOV'),
              ('2026-12-29', '29DEC');

          FOR expiries IN SELECT * FROM temp_expiries LOOP
              FOREACH strike IN ARRAY nifty_strikes LOOP
                  INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange)
                  VALUES 
                      ('NIFTY', 'NIFTY_' || expiries.code || '_' || strike || '_CE', expiries.date, strike, 'CE', 25, 1800, 'NFO'),
                      ('NIFTY', 'NIFTY_' || expiries.code || '_' || strike || '_PE', expiries.date, strike, 'PE', 25, 1800, 'NFO')
                  ON CONFLICT (symbol, expiry_date, strike_price, option_type) DO NOTHING;
              END LOOP;

              FOREACH strike IN ARRAY bank_strikes LOOP
                  INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange)
                  VALUES 
                      ('BANKNIFTY', 'BANKNIFTY_' || expiries.code || '_' || strike || '_CE', expiries.date, strike, 'CE', 15, 900, 'NFO'),
                      ('BANKNIFTY', 'BANKNIFTY_' || expiries.code || '_' || strike || '_PE', expiries.date, strike, 'PE', 15, 900, 'NFO')
                  ON CONFLICT (symbol, expiry_date, strike_price, option_type) DO NOTHING;
              END LOOP;
          END LOOP;

          DROP TABLE IF EXISTS temp_expiries;
      END
      $$;
    `,
  },
  {
    version: '003_wallet_transactions',
    name: 'Wallet Transactions Audit Ledger Table',
    sql: `
      CREATE TABLE IF NOT EXISTS wallet_transactions (
          id              BIGSERIAL PRIMARY KEY,
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          order_id        BIGINT REFERENCES option_orders(id) ON DELETE SET NULL,
          type            VARCHAR(20) NOT NULL CHECK (type IN (
                              'BUY_DEBIT',
                              'SELL_CREDIT',
                              'MARGIN_BLOCK',
                              'MARGIN_RELEASE',
                              'RESET',
                              'ADJUSTMENT'
                          )),
          amount          NUMERIC(15, 2) NOT NULL,
          direction       VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
          balance_after   NUMERIC(15, 2) NOT NULL,
          description     TEXT NOT NULL,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_txn_user_created ON wallet_transactions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_txn_order_id     ON wallet_transactions(order_id);
    `,
  },
  {
    version: '004_schema_hardening',
    name: 'Schema Hardening (Target Price, Trailing SL & Real-time Matching Indexes)',
    sql: `
      ALTER TABLE option_orders
        ADD COLUMN IF NOT EXISTS target_price NUMERIC(10, 2);

      ALTER TABLE option_orders
        ADD COLUMN IF NOT EXISTS trailing_stop_loss NUMERIC(10, 2);

      CREATE INDEX IF NOT EXISTS idx_option_orders_pending
        ON option_orders (user_id, status, created_at DESC)
        WHERE status = 'PENDING';

      CREATE INDEX IF NOT EXISTS idx_option_orders_with_protection
        ON option_orders (status, trigger_price, target_price)
        WHERE status = 'PENDING'
          AND (trigger_price IS NOT NULL OR target_price IS NOT NULL);
    `,
  },
  {
    version: '005_notifications',
    name: 'Notifications Table (User-specific & Broadcast Alerts with JSON Payload Backup)',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
          id              BIGSERIAL PRIMARY KEY,
          user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
          title           VARCHAR(255) NOT NULL,
          message         TEXT NOT NULL,
          type            VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' CHECK (type IN ('ORDER', 'SYSTEM', 'PRICE_ALERT', 'WALLET', 'ANNOUNCEMENT')),
          severity        VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
          is_read         BOOLEAN NOT NULL DEFAULT FALSE,
          data            JSONB DEFAULT '{}'::jsonb,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
      CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(created_at DESC) WHERE user_id IS NULL;
    `,
  },
];

/**
 * Enterprise Production Auto-Migrator
 * Safely creates tables, columns, indexes and seed data on startup or production build.
 */
export async function autoMigrateDatabase(dbInstance?: PostgresProvider): Promise<void> {
  const db = dbInstance ?? PostgresProvider.getInstance();

  // 1. Ensure migrations tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Fetch applied migrations
  const { rows } = await db.query<{ version: string }>('SELECT version FROM schema_migrations;');
  const appliedVersions = new Set(rows.map((r) => r.version));

  // 3. Apply pending migrations sequentially in isolated transactions
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.info(`[AutoMigrate] Applying migration ${migration.version}: ${migration.name}...`);
      await db.withTransaction(async (ctx) => {
        await ctx.query(migration.sql);
        await ctx.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2);',
          [migration.version, migration.name]
        );
      });
      console.info(`[AutoMigrate] ✅ ${migration.version} successfully applied.`);
    }
  }
}
