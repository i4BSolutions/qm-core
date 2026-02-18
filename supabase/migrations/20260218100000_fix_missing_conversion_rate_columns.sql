-- Migration: 20260218100000_fix_missing_conversion_rate_columns.sql
-- Description: Add missing conversion_rate column to qmhq_items and stock_out_approvals.
--              Migration 20260214200000_standard_unit_columns.sql added conversion_rate to
--              po_line_items, invoice_line_items, inventory_transactions, and stock_out_line_items
--              but omitted qmhq_items and stock_out_approvals. The QMHQ detail page (commit f33d553)
--              queries conversion_rate from both tables, causing HTTP 400 errors from PostgREST.
-- Fixes: 400 Bad Request on GET qmhq_items and GET inventory_transactions queries in QMHQ detail page.

-- ============================================================================
-- qmhq_items: add conversion_rate
-- ============================================================================

ALTER TABLE qmhq_items ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,4);

-- Backfill existing rows
UPDATE qmhq_items SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE qmhq_items ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint
ALTER TABLE qmhq_items ADD CONSTRAINT qmhq_items_conversion_rate_positive
  CHECK (conversion_rate > 0);

COMMENT ON COLUMN qmhq_items.conversion_rate IS
  'Conversion rate from item unit to standard unit (multiplier, e.g., 12 for dozen to pieces). Defaults to 1.0 when no conversion applies.';

-- ============================================================================
-- stock_out_approvals: add conversion_rate
-- ============================================================================

ALTER TABLE stock_out_approvals ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(10,4);

-- Backfill existing rows
UPDATE stock_out_approvals SET conversion_rate = 1.0000 WHERE conversion_rate IS NULL;

-- Add NOT NULL constraint
ALTER TABLE stock_out_approvals ALTER COLUMN conversion_rate SET NOT NULL;

-- Add CHECK constraint
ALTER TABLE stock_out_approvals ADD CONSTRAINT stock_out_approvals_conversion_rate_positive
  CHECK (conversion_rate > 0);

COMMENT ON COLUMN stock_out_approvals.conversion_rate IS
  'Conversion rate from item unit to standard unit at the time of approval. Copied from the parent stock_out_line_items.conversion_rate. Defaults to 1.0 for legacy records.';
