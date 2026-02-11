-- ============================================================================
-- Migration: 059_row_lock_status_aggregation.sql
-- Phase: 34-database-trigger-hardening
-- Description: Add row-level locking to status aggregation trigger
--              to prevent stale reads during concurrent line item updates
-- ============================================================================

-- Replace compute_sor_request_status() with row-level locking
CREATE OR REPLACE FUNCTION compute_sor_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
  pending_count INT;
  cancelled_count INT;
  rejected_count INT;
  approved_count INT;
  partially_executed_count INT;
  executed_count INT;
  new_status sor_request_status;
  parent_request_id UUID;
  parent_request_record RECORD;
BEGIN
  -- Get the parent request_id
  IF TG_TABLE_NAME = 'stock_out_line_items' THEN
    parent_request_id := COALESCE(NEW.request_id, OLD.request_id);
  ELSIF TG_TABLE_NAME = 'stock_out_approvals' THEN
    SELECT li.request_id INTO parent_request_id
    FROM stock_out_line_items li
    WHERE li.id = COALESCE(NEW.line_item_id, OLD.line_item_id);
  END IF;

  IF parent_request_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Lock parent request row to prevent concurrent status updates
  -- Ensures only one trigger at a time reads child line item statuses
  -- Lock ordering: line item (already locked by trigger context) -> parent request
  SELECT * INTO parent_request_record
  FROM stock_out_requests
  WHERE id = parent_request_id
  FOR UPDATE;

  -- Count line item statuses (now safe from stale reads)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'partially_executed'),
    COUNT(*) FILTER (WHERE status = 'executed')
  INTO total_count, pending_count, cancelled_count, rejected_count,
       approved_count, partially_executed_count, executed_count
  FROM stock_out_line_items
  WHERE request_id = parent_request_id AND is_active = true;

  -- Compute status
  IF total_count = 0 OR pending_count = total_count THEN
    new_status := 'pending';
  ELSIF cancelled_count = total_count THEN
    new_status := 'cancelled';
  ELSIF rejected_count + cancelled_count = total_count THEN
    new_status := 'rejected';
  ELSIF executed_count = total_count THEN
    new_status := 'executed';
  ELSIF partially_executed_count > 0 OR (executed_count > 0 AND executed_count < total_count) THEN
    new_status := 'partially_executed';
  ELSIF approved_count > 0 AND pending_count > 0 THEN
    new_status := 'partially_approved';
  ELSIF approved_count > 0 AND pending_count = 0 THEN
    new_status := 'approved';
  ELSE
    -- Mixed states: some approved/rejected/cancelled but no pending
    new_status := 'partially_approved';
  END IF;

  -- Update parent request status
  UPDATE stock_out_requests
  SET status = new_status,
      updated_at = NOW()
  WHERE id = parent_request_id
    AND status IS DISTINCT FROM new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compute_sor_request_status() IS
  'Computes parent stock-out request status from child line item statuses with row-level locking to prevent stale reads';
