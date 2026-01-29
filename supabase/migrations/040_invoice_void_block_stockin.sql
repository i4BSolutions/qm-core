-- ============================================
-- Migration: 040_invoice_void_block_stockin.sql
-- Description: Block invoice void when stock-in transactions exist
-- ============================================
-- This migration adds a BEFORE UPDATE trigger that prevents voiding
-- invoices that have associated stock-in (inventory_in) transactions.
-- This protects financial integrity by ensuring inventory that has
-- been physically received cannot be retroactively voided.
--
-- Trigger ordering:
-- - 'aa_' prefix ensures this trigger fires FIRST (alphabetically)
-- - Must fire before invoice_void_recalculate which updates PO quantities
-- - Sequence: aa_block_invoice_void_stockin -> invoice_void_recalculate -> audit triggers
-- ============================================

-- Function to block void if stock-in exists
CREATE OR REPLACE FUNCTION block_invoice_void_with_stockin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stockin_exists BOOLEAN;
BEGIN
  -- Only check when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
    -- Check if any active stock-in transactions exist for this invoice
    SELECT EXISTS (
      SELECT 1 FROM inventory_transactions
      WHERE invoice_id = NEW.id
        AND movement_type = 'inventory_in'
        AND is_active = true
    ) INTO stockin_exists;

    IF stockin_exists THEN
      RAISE EXCEPTION 'Cannot void: inventory has been received against this invoice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger must fire BEFORE the existing recalculate trigger
-- Use 'aa_' prefix to fire first alphabetically among BEFORE UPDATE triggers
DROP TRIGGER IF EXISTS aa_block_invoice_void_stockin ON invoices;
CREATE TRIGGER aa_block_invoice_void_stockin
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION block_invoice_void_with_stockin();

-- Index for efficient lookup of stock-in by invoice_id
-- Note: idx_inventory_transactions_invoice_id already exists from migration 023
-- Adding a more specific partial index for this use case
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_stockin
  ON inventory_transactions(invoice_id)
  WHERE movement_type = 'inventory_in' AND is_active = true;

-- Comments
COMMENT ON FUNCTION block_invoice_void_with_stockin() IS
  'Prevents voiding invoices that have received inventory. Fires BEFORE UPDATE to block the operation before any cascade effects.';

COMMENT ON TRIGGER aa_block_invoice_void_stockin ON invoices IS
  'Blocks invoice void when stock-in transactions exist. Uses aa_ prefix to fire first among BEFORE UPDATE triggers.';
