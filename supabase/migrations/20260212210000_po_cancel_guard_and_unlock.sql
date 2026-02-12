-- ============================================
-- Migration: 20260212210000_po_cancel_guard_and_unlock.sql
-- Description: Block PO cancellation when active non-voided invoices exist
-- ============================================
-- This migration adds a BEFORE UPDATE trigger that prevents cancelling
-- Purchase Orders that have associated active non-voided invoices.
-- This protects financial integrity by ensuring POs with invoice history
-- cannot be retroactively cancelled without first voiding those invoices.
--
-- Trigger ordering:
-- - 'aa_' prefix ensures this trigger fires FIRST (alphabetically)
-- - Must fire before any status recalculation or audit triggers
-- - Sequence: aa_block_po_cancel_with_invoices -> other BEFORE UPDATE triggers -> status calc -> audit
-- ============================================

-- Function to block PO cancellation if active non-voided invoices exist
CREATE OR REPLACE FUNCTION aa_block_po_cancel_with_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_invoice_exists BOOLEAN;
BEGIN
  -- Only check when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Check if any active non-voided invoices exist for this PO
    SELECT EXISTS (
      SELECT 1 FROM invoices
      WHERE po_id = NEW.id
        AND is_active = true
        AND (is_voided = false OR is_voided IS NULL)
    ) INTO active_invoice_exists;

    IF active_invoice_exists THEN
      RAISE EXCEPTION 'Cannot cancel PO: active invoices exist. Void invoices first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger must fire BEFORE other BEFORE UPDATE triggers
-- Use 'aa_' prefix to fire first alphabetically among BEFORE UPDATE triggers
DROP TRIGGER IF EXISTS aa_block_po_cancel_with_invoices ON purchase_orders;
CREATE TRIGGER aa_block_po_cancel_with_invoices
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION aa_block_po_cancel_with_invoices();

-- Partial index for efficient lookup of active non-voided invoices by po_id
-- This optimizes the guard trigger's EXISTS query
CREATE INDEX IF NOT EXISTS idx_invoices_po_active_nonvoided
  ON invoices(po_id)
  WHERE is_active = true AND (is_voided = false OR is_voided IS NULL);

-- Comments
COMMENT ON FUNCTION aa_block_po_cancel_with_invoices() IS
  'Prevents cancelling POs that have active non-voided invoices. Fires BEFORE UPDATE to block the operation before any cascade effects.';

COMMENT ON TRIGGER aa_block_po_cancel_with_invoices ON purchase_orders IS
  'Blocks PO cancellation when active non-voided invoices exist. Uses aa_ prefix to fire first among BEFORE UPDATE triggers.';
