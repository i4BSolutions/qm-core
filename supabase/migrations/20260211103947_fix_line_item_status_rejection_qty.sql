-- Migration: fix_line_item_status_rejection_qty
-- Description: Update line item status trigger to handle rejection quantities.
--   Rejections now carry a qty (stored in approved_quantity field).
--   Line item becomes 'rejected' when total_approved + total_rejected >= requested
--   and there are zero approved qty (all rejected).
--   Line item becomes 'approved' when total_approved >= requested.
--   Otherwise stays 'pending' for further decisions.

CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_approved_qty DECIMAL(15,2);
  total_rejected_qty DECIMAL(15,2);
  total_decided_qty DECIMAL(15,2);
BEGIN
  -- Get line item requested quantity
  SELECT requested_quantity INTO li_requested_quantity
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  -- Calculate total approved quantity
  SELECT COALESCE(SUM(approved_quantity), 0)
  INTO total_approved_qty
  FROM stock_out_approvals
  WHERE line_item_id = NEW.line_item_id
    AND decision = 'approved'
    AND is_active = true;

  -- Calculate total rejected quantity
  SELECT COALESCE(SUM(approved_quantity), 0)
  INTO total_rejected_qty
  FROM stock_out_approvals
  WHERE line_item_id = NEW.line_item_id
    AND decision = 'rejected'
    AND is_active = true;

  total_decided_qty := total_approved_qty + total_rejected_qty;

  IF total_approved_qty >= li_requested_quantity THEN
    -- Fully approved
    UPDATE stock_out_line_items
    SET status = 'approved',
        updated_by = NEW.decided_by,
        updated_at = NOW()
    WHERE id = NEW.line_item_id
      AND status = 'pending';

  ELSIF total_decided_qty >= li_requested_quantity AND total_approved_qty = 0 THEN
    -- Fully rejected (all decided qty is rejected, none approved)
    UPDATE stock_out_line_items
    SET status = 'rejected',
        updated_by = NEW.decided_by,
        updated_at = NOW()
    WHERE id = NEW.line_item_id
      AND status = 'pending';

  -- Otherwise: still pending (partial decisions, more remaining)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_line_item_status_on_approval() IS
  'Updates line item status based on total approved and rejected quantities. Status becomes approved when total_approved >= requested, rejected when fully decided with zero approvals, otherwise stays pending.';
