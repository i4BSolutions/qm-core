-- Migration: 053_stock_out_validation.sql
-- Description: Stock validation functions, status transition enforcement, and fulfillment linkage
-- Dependencies: 052_stock_out_requests.sql, 023_inventory_transactions.sql
-- Phase: 27-stock-out-approval-db-foundation
-- Plan: 27-02

-- ============================================================================
-- STOCK VALIDATION FUNCTIONS
-- ============================================================================

-- Get total stock for an item across ALL warehouses
CREATE OR REPLACE FUNCTION get_total_item_stock(p_item_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'inventory_in' THEN quantity
        WHEN movement_type = 'inventory_out' THEN -quantity
        ELSE 0
      END
    ), 0)
    FROM inventory_transactions
    WHERE item_id = p_item_id
      AND is_active = true
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_total_item_stock(UUID) IS 'Returns total stock for an item across all warehouses (used for SOR creation/approval validation)';

-- ============================================================================
-- LINE ITEM CREATION VALIDATION
-- ============================================================================

-- Validate stock at line item creation
CREATE OR REPLACE FUNCTION validate_sor_line_item_creation()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
BEGIN
  -- Only validate on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  available_stock := get_total_item_stock(NEW.item_id);

  IF NEW.requested_quantity > available_stock THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available across all warehouses: %',
      NEW.requested_quantity, available_stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_li_creation ON stock_out_line_items;
CREATE TRIGGER trg_validate_sor_li_creation
  BEFORE INSERT ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_line_item_creation();

-- ============================================================================
-- APPROVAL VALIDATION
-- ============================================================================

-- Validate approval quantity constraints
CREATE OR REPLACE FUNCTION validate_sor_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  li_item_id UUID;
  total_already_approved DECIMAL(15,2);
  available_stock DECIMAL(15,2);
BEGIN
  -- Get line item details
  SELECT requested_quantity, item_id
  INTO li_requested_quantity, li_item_id
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  -- For approvals: validate approved_quantity doesn't exceed remaining
  IF NEW.decision = 'approved' THEN
    -- Sum of existing approved quantities for this line item (excluding current if update)
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_already_approved
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

    IF (total_already_approved + NEW.approved_quantity) > li_requested_quantity THEN
      RAISE EXCEPTION 'Total approved quantity (% + %) exceeds requested quantity (%)',
        total_already_approved, NEW.approved_quantity, li_requested_quantity;
    END IF;

    -- Validate stock availability at approval time (per user decision: hard block if total stock < approved quantity)
    available_stock := get_total_item_stock(li_item_id);

    IF NEW.approved_quantity > available_stock THEN
      RAISE EXCEPTION 'Approved quantity (%) exceeds available stock across all warehouses (%)',
        NEW.approved_quantity, available_stock;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_approval ON stock_out_approvals;
CREATE TRIGGER trg_validate_sor_approval
  BEFORE INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_approval();

-- ============================================================================
-- LINE ITEM STATUS AUTO-UPDATE ON APPROVAL
-- ============================================================================

-- Update line item status on approval
CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_approved DECIMAL(15,2);
  total_rejected INT;
  total_approvals INT;
BEGIN
  -- Get line item requested quantity
  SELECT requested_quantity INTO li_requested_quantity
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  IF NEW.decision = 'approved' THEN
    -- Update line item status to 'approved' (it can later become partially_executed/executed)
    UPDATE stock_out_line_items
    SET status = 'approved',
        updated_by = NEW.decided_by,
        updated_at = NOW()
    WHERE id = NEW.line_item_id
      AND status = 'pending';  -- Only if currently pending
  ELSIF NEW.decision = 'rejected' THEN
    -- Check if ALL approvals for this line item are rejections
    SELECT COUNT(*) FILTER (WHERE decision = 'approved'),
           COUNT(*)
    INTO total_approved, total_approvals
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND is_active = true;

    -- Only set to 'rejected' if no approvals exist (all rejections)
    IF total_approved = 0 THEN
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

DROP TRIGGER IF EXISTS trg_update_li_status_on_approval ON stock_out_approvals;
CREATE TRIGGER trg_update_li_status_on_approval
  AFTER INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_line_item_status_on_approval();

-- ============================================================================
-- STATUS TRANSITION ENFORCEMENT
-- ============================================================================

-- Line item status transition enforcement
CREATE OR REPLACE FUNCTION validate_sor_line_item_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- No status change, skip
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Once approved, only allowed transitions: approved -> partially_executed -> executed
  IF OLD.status = 'approved' THEN
    IF NEW.status NOT IN ('partially_executed', 'executed') THEN
      RAISE EXCEPTION 'Cannot change line item status from approved to %', NEW.status;
    END IF;
  END IF;

  -- Once rejected, cannot change
  IF OLD.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot change status of rejected line item';
  END IF;

  -- Once cancelled, cannot change
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled line item';
  END IF;

  -- Can only cancel if pending (per user decision)
  IF NEW.status = 'cancelled' AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending line items, current status: %', OLD.status;
  END IF;

  -- partially_executed can only go to executed
  IF OLD.status = 'partially_executed' AND NEW.status != 'executed' THEN
    RAISE EXCEPTION 'Partially executed line items can only transition to executed';
  END IF;

  -- executed is terminal
  IF OLD.status = 'executed' THEN
    RAISE EXCEPTION 'Cannot change status of fully executed line item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_li_status_transition ON stock_out_line_items;
CREATE TRIGGER trg_validate_sor_li_status_transition
  BEFORE UPDATE OF status ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_line_item_status_transition();

-- ============================================================================
-- FULFILLMENT LINKAGE
-- ============================================================================

-- Add nullable FK to link fulfillment inventory_out to the approval that authorized it
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS stock_out_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_sor_approval
  ON inventory_transactions(stock_out_approval_id) WHERE stock_out_approval_id IS NOT NULL;

COMMENT ON COLUMN inventory_transactions.stock_out_approval_id IS 'Links inventory_out to the stock_out_approval that authorized it';

-- ============================================================================
-- OVER-EXECUTION BLOCKING
-- ============================================================================

-- Over-execution blocking
CREATE OR REPLACE FUNCTION validate_sor_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  approval_qty DECIMAL(15,2);
  total_executed DECIMAL(15,2);
  approval_decision TEXT;
BEGIN
  -- Only validate inventory_out transactions linked to a stock_out_approval
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get approval details
  SELECT approved_quantity, decision
  INTO approval_qty, approval_decision
  FROM stock_out_approvals
  WHERE id = NEW.stock_out_approval_id
    AND is_active = true;

  IF approval_qty IS NULL THEN
    RAISE EXCEPTION 'Stock-out approval not found';
  END IF;

  IF approval_decision != 'approved' THEN
    RAISE EXCEPTION 'Cannot fulfill a rejected stock-out approval';
  END IF;

  -- Sum of existing executed quantities for this approval
  SELECT COALESCE(SUM(quantity), 0)
  INTO total_executed
  FROM inventory_transactions
  WHERE stock_out_approval_id = NEW.stock_out_approval_id
    AND movement_type = 'inventory_out'
    AND is_active = true
    AND status = 'completed'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  IF (total_executed + NEW.quantity) > approval_qty THEN
    RAISE EXCEPTION 'Over-execution blocked. Approved: %, Already executed: %, Attempting: %',
      approval_qty, total_executed, NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_fulfillment ON inventory_transactions;
CREATE TRIGGER trg_validate_sor_fulfillment
  BEFORE INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_fulfillment();

-- ============================================================================
-- AUTO-UPDATE LINE ITEM EXECUTION STATUS
-- ============================================================================

-- Auto-update line item execution status on fulfillment
CREATE OR REPLACE FUNCTION update_sor_line_item_execution_status()
RETURNS TRIGGER AS $$
DECLARE
  approval_record RECORD;
  total_executed DECIMAL(15,2);
  total_approved_for_li DECIMAL(15,2);
  total_executed_for_li DECIMAL(15,2);
  li_id UUID;
BEGIN
  -- Only care about completed inventory_out with approval link
  IF NEW.movement_type != 'inventory_out' OR NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get the approval and its line item
  SELECT a.id, a.line_item_id, a.approved_quantity
  INTO approval_record
  FROM stock_out_approvals a
  WHERE a.id = NEW.stock_out_approval_id;

  li_id := approval_record.line_item_id;

  -- Calculate total approved and total executed for the entire line item
  SELECT COALESCE(SUM(approved_quantity), 0)
  INTO total_approved_for_li
  FROM stock_out_approvals
  WHERE line_item_id = li_id
    AND decision = 'approved'
    AND is_active = true;

  SELECT COALESCE(SUM(it.quantity), 0)
  INTO total_executed_for_li
  FROM inventory_transactions it
  JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id
  WHERE a.line_item_id = li_id
    AND it.movement_type = 'inventory_out'
    AND it.is_active = true
    AND it.status = 'completed';

  -- Update line item status based on execution progress
  IF total_executed_for_li >= total_approved_for_li AND total_approved_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('approved', 'partially_executed');
  ELSIF total_executed_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'partially_executed', updated_at = NOW()
    WHERE id = li_id AND status = 'approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_sor_li_execution_status ON inventory_transactions;
CREATE TRIGGER trg_update_sor_li_execution_status
  AFTER INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_sor_line_item_execution_status();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_total_item_stock(UUID) TO authenticated;
