-- ==============================================================================
-- TradeMitra - Migration 004: Missing Columns + Schema Hardening
-- Author: Sumer Kumar
-- Description: Adds target_price column that was missing from option_orders,
--              fixes trailing_stop_loss column references, and adds missing
--              columns that the application code expects but DB schema lacks.
-- ==============================================================================

-- Fix: Add target_price column (code inserts this but column was missing!)
ALTER TABLE option_orders
  ADD COLUMN IF NOT EXISTS target_price NUMERIC(10, 2);

-- Ensure trailing_stop_loss exists (it was in schema but verify)
ALTER TABLE option_orders
  ADD COLUMN IF NOT EXISTS trailing_stop_loss NUMERIC(10, 2);

-- Add index for pending order scanning (used by processTickForOrders every tick)
CREATE INDEX IF NOT EXISTS idx_option_orders_pending
  ON option_orders (user_id, status, created_at DESC)
  WHERE status = 'PENDING';

-- Add index for SL/Target monitoring — only PENDING orders with protection
CREATE INDEX IF NOT EXISTS idx_option_orders_with_protection
  ON option_orders (status, trigger_price, target_price)
  WHERE status = 'PENDING'
    AND (trigger_price IS NOT NULL OR target_price IS NOT NULL);

COMMENT ON COLUMN option_orders.target_price IS
  'Optional auto-exit target price. When LTP hits this, a reverse order fires automatically.';
COMMENT ON COLUMN option_orders.trailing_stop_loss IS
  'Trailing SL delta step. e.g., ₹5 means SL moves up ₹5 each time price moves ₹5 in favour.';

-- Verify the fix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'option_orders' AND column_name = 'target_price'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: target_price column not added!';
  END IF;
  RAISE NOTICE 'Migration 004: target_price column verified OK.';
END;
$$;
