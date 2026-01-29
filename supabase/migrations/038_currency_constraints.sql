-- Migration: 038_currency_constraints.sql
-- Description: Add currency and exchange rate validation constraints to inventory_transactions
-- Purpose: Ensure database-layer validation for financial data integrity and prevent corrupt WAC calculations

-- ============================================
-- Currency Code Constraint
-- ============================================
-- Only allow supported currency codes: USD, MMK, CNY, THB
-- This prevents invalid currency values from being stored and ensures
-- consistent WAC calculations across the system.

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_currency_valid;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB'));

COMMENT ON CONSTRAINT inventory_transactions_currency_valid ON inventory_transactions IS
  'Enforces valid currency codes: USD (US Dollar), MMK (Myanmar Kyat), CNY (Chinese Yuan), THB (Thai Baht)';

-- ============================================
-- Exchange Rate Positive Constraint
-- ============================================
-- Exchange rate must be positive (greater than zero)
-- Zero or negative exchange rates would cause division errors in EUSD calculations
-- and corrupt WAC values.

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_exchange_rate_positive;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_exchange_rate_positive
  CHECK (exchange_rate > 0);

COMMENT ON CONSTRAINT inventory_transactions_exchange_rate_positive ON inventory_transactions IS
  'Prevents zero or negative exchange rates which would corrupt EUSD calculations';

-- ============================================
-- USD Exchange Rate Must Be 1.0 Constraint
-- ============================================
-- Business rule: USD is the reference currency (EUSD = Equivalent USD)
-- When currency is USD, exchange rate must be exactly 1.0
-- This ensures 1 USD = 1 EUSD by definition.

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_usd_rate_one;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_usd_rate_one
  CHECK (currency != 'USD' OR exchange_rate = 1.0);

COMMENT ON CONSTRAINT inventory_transactions_usd_rate_one ON inventory_transactions IS
  'USD is the reference currency; USD transactions must have exchange_rate = 1.0 (1 USD = 1 EUSD)';
