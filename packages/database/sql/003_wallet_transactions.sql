-- ==============================================================================
-- TradeMitra - Wallet Transactions Ledger (v1.1.0)
-- Author: Sumer Kumar
-- Description: Append-only ledger recording every wallet debit/credit event.
--              Enables full transaction history for paper trading funds.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        BIGINT REFERENCES option_orders(id) ON DELETE SET NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN (
                        'BUY_DEBIT',        -- Premium debited on BUY order
                        'SELL_CREDIT',      -- Premium credited on SELL/exit order
                        'MARGIN_BLOCK',     -- SPAN margin blocked for short SELL
                        'MARGIN_RELEASE',   -- SPAN margin released on position close
                        'RESET',            -- Manual wallet reset to ₹10,00,000
                        'ADJUSTMENT'        -- Internal correction / reconciliation
                    )),
    amount          NUMERIC(15, 2) NOT NULL,          -- Always positive; type implies direction
    direction       VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    balance_after   NUMERIC(15, 2) NOT NULL,          -- Snapshot of available margin after event
    description     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_order_id     ON wallet_transactions(order_id);

COMMENT ON TABLE wallet_transactions IS
  'Append-only ledger of all wallet debit/credit events for paper trading audit trail.';
