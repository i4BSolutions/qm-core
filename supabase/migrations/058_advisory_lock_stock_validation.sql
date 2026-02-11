-- ============================================================================
-- Migration: 058_advisory_lock_stock_validation.sql
-- Phase: 34-database-trigger-hardening
-- Description: Add advisory locks to stock validation and fulfillment triggers
--              to prevent race conditions during concurrent execution
-- ============================================================================

-- Replace validate_stock_out_quantity() with advisory lock hardening
CREATE OR REPLACE FUNCTION validate_stock_out_quantity()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
  lock_key BIGINT;
BEGIN
  -- Only validate inventory_out transactions
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  -- Only validate completed transactions
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Acquire transaction-level advisory lock on item
  -- Serializes concurrent stock-out validation for the same item
  -- Lock automatically released on COMMIT or ROLLBACK
  lock_key := hashtext(NEW.item_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Get available stock (now serialized)
  available_stock := get_warehouse_stock(NEW.item_id, NEW.warehouse_id);

  -- For updates, add back the old quantity if it was from the same transaction
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    available_stock := available_stock + OLD.quantity;
  END IF;

  -- Validate quantity
  IF NEW.quantity > available_stock THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %',
      NEW.quantity, available_stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_stock_out_quantity() IS
  'Validates stock availability for inventory_out transactions with advisory lock to prevent negative stock from concurrent executions';

-- Replace validate_sor_fulfillment() with advisory lock hardening
CREATE OR REPLACE FUNCTION validate_sor_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  approval_qty DECIMAL(15,2);
  total_executed DECIMAL(15,2);
  approval_decision TEXT;
  lock_key BIGINT;
BEGIN
  -- Only validate inventory_out transactions linked to a stock_out_approval
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Acquire transaction-level advisory lock on approval
  -- Serializes concurrent execution validation for the same approval
  -- Prevents over-execution when multiple transactions attempt to fulfill the same approval
  lock_key := hashtext(NEW.stock_out_approval_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

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

  -- Sum of existing executed quantities for this approval (now serialized)
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

COMMENT ON FUNCTION validate_sor_fulfillment() IS
  'Validates stock-out approval execution with advisory lock to prevent over-execution from concurrent transactions';
