-- Migration: 20260216400000_usd_exchange_rate_constraints.sql
-- Description: Add USD exchange rate, positive rate, and currency validation constraints to financial tables
-- Purpose: Enforce USD=1.0 exchange rate rule at database level across purchase_orders, invoices,
--          financial_transactions, and qmhq tables. USD is the reference currency (1 USD = 1 EUSD).
-- Pattern: Follows 038_currency_constraints.sql pattern from inventory_transactions

-- ============================================
-- PURCHASE ORDERS - Currency Constraints
-- ============================================

-- Valid currency codes for purchase orders
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_currency_valid;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB'));

COMMENT ON CONSTRAINT purchase_orders_currency_valid ON purchase_orders IS
  'Enforces valid currency codes: USD (US Dollar), MMK (Myanmar Kyat), CNY (Chinese Yuan), THB (Thai Baht)';

-- Exchange rate must be positive
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_exchange_rate_positive;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_exchange_rate_positive
  CHECK (exchange_rate > 0);

COMMENT ON CONSTRAINT purchase_orders_exchange_rate_positive ON purchase_orders IS
  'Prevents zero or negative exchange rates which would corrupt EUSD calculations';

-- USD exchange rate must be 1.0
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_usd_rate_one;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_usd_rate_one
  CHECK (currency != 'USD' OR exchange_rate = 1.0);

COMMENT ON CONSTRAINT purchase_orders_usd_rate_one ON purchase_orders IS
  'USD is the reference currency; USD purchase orders must have exchange_rate = 1.0 (1 USD = 1 EUSD)';

-- ============================================
-- INVOICES - Currency Constraints
-- ============================================

-- Valid currency codes for invoices
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_currency_valid;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB'));

COMMENT ON CONSTRAINT invoices_currency_valid ON invoices IS
  'Enforces valid currency codes: USD (US Dollar), MMK (Myanmar Kyat), CNY (Chinese Yuan), THB (Thai Baht)';

-- Exchange rate must be positive
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_exchange_rate_positive;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_exchange_rate_positive
  CHECK (exchange_rate > 0);

COMMENT ON CONSTRAINT invoices_exchange_rate_positive ON invoices IS
  'Prevents zero or negative exchange rates which would corrupt EUSD calculations';

-- USD exchange rate must be 1.0
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_usd_rate_one;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_usd_rate_one
  CHECK (currency != 'USD' OR exchange_rate = 1.0);

COMMENT ON CONSTRAINT invoices_usd_rate_one ON invoices IS
  'USD is the reference currency; USD invoices must have exchange_rate = 1.0 (1 USD = 1 EUSD)';

-- ============================================
-- FINANCIAL TRANSACTIONS - Currency Constraints
-- ============================================

-- Valid currency codes for financial transactions (includes EUR and SGD)
ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_currency_valid;

ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB', 'EUR', 'SGD'));

COMMENT ON CONSTRAINT financial_transactions_currency_valid ON financial_transactions IS
  'Enforces valid currency codes: USD, MMK, CNY, THB, EUR (Euro), SGD (Singapore Dollar)';

-- Exchange rate must be positive
ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_exchange_rate_positive;

ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_exchange_rate_positive
  CHECK (exchange_rate > 0);

COMMENT ON CONSTRAINT financial_transactions_exchange_rate_positive ON financial_transactions IS
  'Prevents zero or negative exchange rates which would corrupt EUSD calculations';

-- USD exchange rate must be 1.0
ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_usd_rate_one;

ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_usd_rate_one
  CHECK (currency != 'USD' OR exchange_rate = 1.0);

COMMENT ON CONSTRAINT financial_transactions_usd_rate_one ON financial_transactions IS
  'USD is the reference currency; USD transactions must have exchange_rate = 1.0 (1 USD = 1 EUSD)';

-- ============================================
-- QMHQ - Currency Constraints
-- ============================================

-- Valid currency codes for QMHQ (includes EUR and SGD, covers expense and PO routes)
ALTER TABLE qmhq
  DROP CONSTRAINT IF EXISTS qmhq_currency_valid;

ALTER TABLE qmhq
  ADD CONSTRAINT qmhq_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB', 'EUR', 'SGD'));

COMMENT ON CONSTRAINT qmhq_currency_valid ON qmhq IS
  'Enforces valid currency codes: USD, MMK, CNY, THB, EUR (Euro), SGD (Singapore Dollar)';

-- Exchange rate must be positive (QMHQ item route has no exchange rate but column defaults to 1.0)
ALTER TABLE qmhq
  DROP CONSTRAINT IF EXISTS qmhq_exchange_rate_positive;

ALTER TABLE qmhq
  ADD CONSTRAINT qmhq_exchange_rate_positive
  CHECK (exchange_rate > 0);

COMMENT ON CONSTRAINT qmhq_exchange_rate_positive ON qmhq IS
  'Prevents zero or negative exchange rates which would corrupt EUSD calculations';

-- USD exchange rate must be 1.0
ALTER TABLE qmhq
  DROP CONSTRAINT IF EXISTS qmhq_usd_rate_one;

ALTER TABLE qmhq
  ADD CONSTRAINT qmhq_usd_rate_one
  CHECK (currency != 'USD' OR exchange_rate = 1.0);

COMMENT ON CONSTRAINT qmhq_usd_rate_one ON qmhq IS
  'USD is the reference currency; USD QMHQ records must have exchange_rate = 1.0 (1 USD = 1 EUSD)';
