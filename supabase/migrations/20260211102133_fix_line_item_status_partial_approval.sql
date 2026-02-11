-- Migration: 20260211102133_fix_line_item_status_partial_approval.sql
-- Description: Fix line item status transition to only become 'approved' when
--              total approved quantity >= requested quantity (not after first approval)
-- Issue: SOR-premature-fulfilled-status debug
-- Root Cause: update_line_item_status_on_approval() was setting status='approved'
--             after ANY approval, causing parent SOR status to incorrectly aggregate
--             to 'approved' even when line items still had remaining quantity.

-- ============================================================================
-- FIX: Update line item status transition logic
-- ============================================================================

CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_approved_quantity DECIMAL(15,2);
  total_rejected_count INT;
  total_approvals_count INT;
BEGIN
  -- Get line item requested quantity
  SELECT requested_quantity INTO li_requested_quantity
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  IF NEW.decision = 'approved' THEN
    -- Calculate total approved quantity for this line item (including this new approval)
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_approved_quantity
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND is_active = true;

    -- Only transition to 'approved' if total approved >= requested
    IF total_approved_quantity >= li_requested_quantity THEN
      UPDATE stock_out_line_items
      SET status = 'approved',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'pending';
    END IF;
    -- Otherwise, leave status as 'pending' to allow further approvals

  ELSIF NEW.decision = 'rejected' THEN
    -- Check if ALL approvals for this line item are rejections
    SELECT COUNT(*) FILTER (WHERE decision = 'approved'),
           COUNT(*)
    INTO total_approved_quantity, total_approvals_count
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND is_active = true;

    -- Only set to 'rejected' if no approvals exist (all rejections)
    IF total_approved_quantity = 0 THEN
      UPDATE stock_out_line_items
      SET status = 'rejected',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'pending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_line_item_status_on_approval() IS
  'Updates line item status to approved only when total approved quantity >= requested quantity. Allows partial approvals to keep line item in pending state.';
