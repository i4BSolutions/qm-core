-- Migration: Fix PO received_quantity propagation
-- Description: Add missing trigger to aggregate received_quantity from invoice_line_items to po_line_items
-- Issue: po-received-qty-stale
-- Root Cause: Stock-in updates invoice_line_items.received_quantity but there's no trigger to propagate to po_line_items
-- Solution: Mirror the existing invoiced_quantity pattern with a received_quantity trigger

-- Function to update po_line_items.received_quantity
-- This aggregates received_quantity from all invoice_line_items for a given po_line_item
CREATE OR REPLACE FUNCTION update_po_line_received_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_po_line_id UUID;
  new_received_qty DECIMAL(15,2);
BEGIN
  -- Determine the PO line item to update
  IF TG_OP = 'DELETE' THEN
    target_po_line_id := OLD.po_line_item_id;
  ELSE
    target_po_line_id := NEW.po_line_item_id;
  END IF;

  -- Calculate total received quantity from all invoice line items
  -- This aggregates across all invoices for this PO line item
  SELECT COALESCE(SUM(ili.received_quantity), 0)
  INTO new_received_qty
  FROM invoice_line_items ili
  WHERE ili.po_line_item_id = target_po_line_id
    AND ili.is_active = true;

  -- Update PO line item received_quantity
  UPDATE po_line_items
  SET received_quantity = new_received_qty,
      updated_at = NOW()
  WHERE id = target_po_line_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO line received quantity
-- Fires AFTER changes to invoice_line_items to propagate received_quantity updates
-- This will then trigger po_line_item_update_status to recalculate PO status
DROP TRIGGER IF EXISTS invoice_line_update_po_received ON invoice_line_items;
CREATE TRIGGER invoice_line_update_po_received
  AFTER INSERT OR UPDATE OF received_quantity OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_line_received_quantity();

-- Comment
COMMENT ON FUNCTION update_po_line_received_quantity() IS 'Aggregates received_quantity from invoice_line_items to po_line_items, mirrors the invoiced_quantity pattern';
