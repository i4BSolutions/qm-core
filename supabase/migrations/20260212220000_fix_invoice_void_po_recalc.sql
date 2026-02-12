-- ============================================================================
-- Migration: 20260212220000_fix_invoice_void_po_recalc.sql
-- Description: Fix invoice void PO recalculation bug
-- ============================================================================
--
-- BUG: When an invoice is voided, PO metrics (status, invoiced_quantity, etc.)
-- do not update because the recalculate_po_on_invoice_void() trigger runs
-- BEFORE the invoice UPDATE completes. The subquery filters `i.is_voided = false`
-- but sees the OLD row values, incorrectly including the invoice being voided.
--
-- FIX: Explicitly exclude the invoice being voided (NEW.id) from the subquery.
--
-- Root cause analysis: .planning/debug/invoice-void-po-recalc.md
-- ============================================================================

-- Replace recalculate_po_on_invoice_void function with fixed version
CREATE OR REPLACE FUNCTION recalculate_po_on_invoice_void()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
    -- Recalculate all affected PO line items
    -- CRITICAL FIX: Explicitly exclude NEW.id from the subquery
    -- Since this is a BEFORE trigger, the invoices table still shows OLD values,
    -- so we can't rely on i.is_voided = false to exclude the invoice being voided
    UPDATE po_line_items
    SET invoiced_quantity = (
      SELECT COALESCE(SUM(ili.quantity), 0)
      FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id
      WHERE ili.po_line_item_id = po_line_items.id
        AND ili.is_active = true
        AND i.is_voided = false
        AND i.id != NEW.id  -- ← FIX: Explicitly exclude invoice being voided
    ),
    updated_at = NOW()
    WHERE id IN (
      SELECT DISTINCT po_line_item_id
      FROM invoice_line_items
      WHERE invoice_id = NEW.id
    );

    -- Record void timestamp
    NEW.voided_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_po_on_invoice_void() IS
  'Recalculates po_line_items.invoiced_quantity when an invoice is voided. Explicitly excludes the invoice being voided from the SUM to work correctly in BEFORE trigger context.';
