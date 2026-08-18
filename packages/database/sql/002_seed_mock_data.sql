-- ==============================================================================
-- TradeMitra - Seed Data (v1.0.0)
-- Author: Sumer Kumar
-- Description: Seed initial demo user, wallet, and NIFTY/BANKNIFTY option contracts
-- ==============================================================================

-- 1. Insert Demo User (Password: Password@123)
INSERT INTO users (auth_id, email, password_hash, full_name, phone, pan_masked, kyc_status)
VALUES 
    ('usr_sumer_001', 'sumer.kumar@trademitra.local', '$2b$10$a8SRLLgkab/FE/frGeUyCunYsfHwsma8WESXz6mxVDlCvpa1uhgO.', 'Sumer Kumar', '+919876543210', 'ABCDE1234F', 'VERIFIED')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 2. Insert User Wallet with ₹10,00,000 Paper Trading Margin
INSERT INTO wallets (user_id, cash_balance, pledge_margin, utilized_margin, currency)
SELECT id, 1000000.00, 0.00, 0.00, 'INR'
FROM users
WHERE email = 'sumer.kumar@trademitra.local'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Insert NIFTY & BANKNIFTY Weekly Option Contracts dynamically
DO $$
DECLARE
    strike INT;
    nifty_strikes INT[] := ARRAY[23950, 24000, 24050, 24100, 24150, 24200, 24250, 24300, 24350, 24400, 24450, 24500];
    bank_strikes INT[] := ARRAY[57000, 57100, 57200, 57300, 57400, 57500, 57600];
    expiries RECORD;
BEGIN
    CREATE TEMP TABLE temp_expiries (date DATE, code VARCHAR);
    INSERT INTO temp_expiries VALUES 
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
        -- 1. Insert NIFTY Contracts
        FOREACH strike IN ARRAY nifty_strikes LOOP
            INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange)
            VALUES 
                ('NIFTY', 'NIFTY_' || expiries.code || '_' || strike || '_CE', expiries.date, strike, 'CE', 25, 1800, 'NFO'),
                ('NIFTY', 'NIFTY_' || expiries.code || '_' || strike || '_PE', expiries.date, strike, 'PE', 25, 1800, 'NFO')
            ON CONFLICT (symbol, expiry_date, strike_price, option_type) DO NOTHING;
        END LOOP;

        -- 2. Insert BANKNIFTY Contracts
        FOREACH strike IN ARRAY bank_strikes LOOP
            INSERT INTO options_contracts (symbol, trading_symbol, expiry_date, strike_price, option_type, lot_size, freeze_limit, exchange)
            VALUES 
                ('BANKNIFTY', 'BANKNIFTY_' || expiries.code || '_' || strike || '_CE', expiries.date, strike, 'CE', 15, 900, 'NFO'),
                ('BANKNIFTY', 'BANKNIFTY_' || expiries.code || '_' || strike || '_PE', expiries.date, strike, 'PE', 15, 900, 'NFO')
            ON CONFLICT (symbol, expiry_date, strike_price, option_type) DO NOTHING;
        END LOOP;
    END LOOP;

    DROP TABLE temp_expiries;
END
$$;
