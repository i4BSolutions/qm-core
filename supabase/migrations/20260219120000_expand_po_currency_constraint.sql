-- Migration: 20260219120000_expand_po_currency_constraint.sql
-- Description: Expand purchase_orders and invoices currency constraints to include EUR and SGD
-- Purpose: Fix constraint violation (23514) when creating POs from QMHQs with EUR or SGD currency.
--          QMHQ allows EUR/SGD but purchase_orders and invoices previously only allowed USD/MMK/CNY/THB.
--          This aligns all financial tables to support the same currency set.

-- ============================================
-- PURCHASE ORDERS - Expand Currency Constraint
-- ============================================

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_currency_valid;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB', 'EUR', 'SGD'));

COMMENT ON CONSTRAINT purchase_orders_currency_valid ON purchase_orders IS
  'Enforces valid currency codes: USD, MMK, CNY, THB, EUR (Euro), SGD (Singapore Dollar)';

-- ============================================
-- INVOICES - Expand Currency Constraint
-- ============================================

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_currency_valid;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_currency_valid
  CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB', 'EUR', 'SGD'));

COMMENT ON CONSTRAINT invoices_currency_valid ON invoices IS
  'Enforces valid currency codes: USD, MMK, CNY, THB, EUR (Euro), SGD (Singapore Dollar)';
