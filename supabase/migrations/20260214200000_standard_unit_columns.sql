-- Migration: 20260214200000_standard_unit_columns.sql
-- Description: Add conversion_rate and standard_qty columns to all quantity-bearing transaction tables
-- Phase: 47-schema-data-foundation
-- Plan: 47-01
-- Purpose: Establishes the database foundation for the Standard Unit System (v1.11)

-- ============================================================================
-- PO LINE ITEMS
-- ============================================================================

-- Add conversion_rate column (nullable first for backfill)
ALTER TABLE po_line_items ADD COLUMN conversion_rate DECIMAL(10,4);

-- Backfill all existing rows with conversion_rate = 1.0000
UPDATE po_line_items SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE po_line_items ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint to ensure conversion_rate is positive
ALTER TABLE po_line_items ADD CONSTRAINT po_line_items_conversion_rate_positive
  CHECK (conversion_rate > 0);

-- Add generated column for standard_qty (quantity * conversion_rate)
ALTER TABLE po_line_items ADD COLUMN standard_qty DECIMAL(15,2)
  GENERATED ALWAYS AS (ROUND(quantity * conversion_rate, 2)) STORED;

-- Add comments
COMMENT ON COLUMN po_line_items.conversion_rate IS 'Conversion rate from item unit to standard unit (multiplier, e.g., 12 for dozen to pieces)';
COMMENT ON COLUMN po_line_items.standard_qty IS 'Generated column: quantity * conversion_rate, represents quantity in standard units';

-- ============================================================================
-- INVOICE LINE ITEMS
-- ============================================================================

-- Add conversion_rate column (nullable first for backfill)
ALTER TABLE invoice_line_items ADD COLUMN conversion_rate DECIMAL(10,4);

-- Backfill all existing rows with conversion_rate = 1.0000
UPDATE invoice_line_items SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE invoice_line_items ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint to ensure conversion_rate is positive
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_conversion_rate_positive
  CHECK (conversion_rate > 0);

-- Add generated column for standard_qty (quantity * conversion_rate)
ALTER TABLE invoice_line_items ADD COLUMN standard_qty DECIMAL(15,2)
  GENERATED ALWAYS AS (ROUND(quantity * conversion_rate, 2)) STORED;

-- Add comments
COMMENT ON COLUMN invoice_line_items.conversion_rate IS 'Conversion rate from item unit to standard unit (multiplier, e.g., 12 for dozen to pieces)';
COMMENT ON COLUMN invoice_line_items.standard_qty IS 'Generated column: quantity * conversion_rate, represents quantity in standard units';

-- ============================================================================
-- INVENTORY TRANSACTIONS
-- ============================================================================

-- Add conversion_rate column (nullable first for backfill)
ALTER TABLE inventory_transactions ADD COLUMN conversion_rate DECIMAL(10,4);

-- Backfill all existing rows with conversion_rate = 1.0000
UPDATE inventory_transactions SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE inventory_transactions ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint to ensure conversion_rate is positive
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_conversion_rate_positive
  CHECK (conversion_rate > 0);

-- Add generated column for standard_qty (quantity * conversion_rate)
ALTER TABLE inventory_transactions ADD COLUMN standard_qty DECIMAL(15,2)
  GENERATED ALWAYS AS (ROUND(quantity * conversion_rate, 2)) STORED;

-- Add comments
COMMENT ON COLUMN inventory_transactions.conversion_rate IS 'Conversion rate from item unit to standard unit (multiplier, e.g., 12 for dozen to pieces)';
COMMENT ON COLUMN inventory_transactions.standard_qty IS 'Generated column: quantity * conversion_rate, represents quantity in standard units';

-- ============================================================================
-- STOCK OUT LINE ITEMS
-- ============================================================================

-- Add conversion_rate column (nullable first for backfill)
ALTER TABLE stock_out_line_items ADD COLUMN conversion_rate DECIMAL(10,4);

-- Backfill all existing rows with conversion_rate = 1.0000
UPDATE stock_out_line_items SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE stock_out_line_items ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint to ensure conversion_rate is positive
ALTER TABLE stock_out_line_items ADD CONSTRAINT stock_out_line_items_conversion_rate_positive
  CHECK (conversion_rate > 0);

-- Add generated column for standard_qty (requested_quantity * conversion_rate)
ALTER TABLE stock_out_line_items ADD COLUMN standard_qty DECIMAL(15,2)
  GENERATED ALWAYS AS (ROUND(requested_quantity * conversion_rate, 2)) STORED;

-- Add comments
COMMENT ON COLUMN stock_out_line_items.conversion_rate IS 'Conversion rate from item unit to standard unit (multiplier, e.g., 12 for dozen to pieces)';
COMMENT ON COLUMN stock_out_line_items.standard_qty IS 'Generated column: requested_quantity * conversion_rate, represents requested quantity in standard units';
