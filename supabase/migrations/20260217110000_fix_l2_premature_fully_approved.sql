-- Migration: 20260217110000_fix_l2_premature_fully_approved.sql
-- Description: Fix three bugs in the two-layer approval trigger functions:
--
--   Bug 1 (update_line_item_status_on_approval):
--     L2 trigger prematurely transitions awaiting_admin -> fully_approved on the
--     FIRST warehouse assignment, even when only partial L1 qty is covered.
--     Fix: Only transition when total L2 assigned qty >= total L1 approved qty.
--
--   Bug 2 (update_sor_line_item_execution_status):
--     Execution completion check sums ALL approved records (L1 + L2 combined),
--     causing inflated total_approved_for_li. Inventory transactions are only
--     linked to L2 (admin layer) approvals, so execution progress must only be
--     compared against L2 approved quantities.
--     Also: awaiting_admin items can have L2 assignments executed before full
--     L2 coverage — trigger must handle awaiting_admin -> partially_executed.
--     Fix: Filter total_approved_for_li to layer='admin' only; add awaiting_admin
--          to valid source states for partially_executed.
--
--   Bug 3 (validate_sor_line_item_status_transition):
--     awaiting_admin items cannot transition to partially_executed because the
--     guard only allows awaiting_admin -> fully_approved. When execution happens
--     before full L2 coverage, the guard would block the status update.
--     Fix: Allow awaiting_admin -> partially_executed and awaiting_admin -> executed
--          in addition to awaiting_admin -> fully_approved.
--
-- Phase: 57-sor-execution-page

BEGIN;

-- ============================================================================
-- FIX 3: validate_sor_line_item_status_transition
-- Allow awaiting_admin -> partially_executed and awaiting_admin -> executed
-- to handle execution before full L2 warehouse coverage.
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_sor_line_item_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- No status change, skip
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Use explicit allowed-transitions per source status
  CASE OLD.status
    WHEN 'pending' THEN
      -- pending can go to: awaiting_admin (L1 approval), rejected (L1 rejection), cancelled
      IF NEW.status NOT IN ('awaiting_admin', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Pending items can only transition to awaiting_admin, rejected, or cancelled.',
          OLD.status, NEW.status;
      END IF;

    WHEN 'awaiting_admin' THEN
      -- awaiting_admin can go to:
      --   fully_approved: all L2 assignments cover all L1 qty
      --   partially_executed: execution happened before full L2 coverage
      --   executed: all L2 assignments executed (edge case: single L2 = all qty)
      IF NEW.status NOT IN ('fully_approved', 'partially_executed', 'executed') THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Items awaiting admin assignment can only transition to fully_approved, partially_executed, or executed.',
          OLD.status, NEW.status;
      END IF;

    WHEN 'approved' THEN
      -- Legacy status: backfill transition to fully_approved is valid.
      -- Also allow execution transitions for records already in execution flow.
      IF NEW.status NOT IN ('fully_approved', 'partially_executed', 'executed') THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Approved items can transition to fully_approved, partially_executed, or executed.',
          OLD.status, NEW.status;
      END IF;

    WHEN 'fully_approved' THEN
      -- fully_approved is the execution-ready state
      IF NEW.status NOT IN ('partially_executed', 'executed') THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Fully approved items can only transition to partially_executed or executed.',
          OLD.status, NEW.status;
      END IF;

    WHEN 'partially_executed' THEN
      IF NEW.status != 'executed' THEN
        RAISE EXCEPTION 'Partially executed line items can only transition to executed, not %.',
          NEW.status;
      END IF;

    WHEN 'rejected' THEN
      RAISE EXCEPTION 'Cannot change status of rejected line item';

    WHEN 'cancelled' THEN
      RAISE EXCEPTION 'Cannot change status of cancelled line item';

    WHEN 'executed' THEN
      RAISE EXCEPTION 'Cannot change status of fully executed line item';

    ELSE
      RAISE EXCEPTION 'Unknown source status: %', OLD.status;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_sor_line_item_status_transition() IS
  'Enforces valid status transitions for stock-out line items in the two-layer approval flow. awaiting_admin -> fully_approved (all L2 covered), awaiting_admin -> partially_executed/executed (execution before full L2 coverage), fully_approved -> partially_executed/executed.';

-- ============================================================================
-- FIX 1: update_line_item_status_on_approval
-- Only transition awaiting_admin -> fully_approved when ALL L1 qty is covered
-- ============================================================================
CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_l1_approved_qty DECIMAL(15,2);
  total_rejected_qty DECIMAL(15,2);
  total_decided_qty DECIMAL(15,2);
  total_l2_assigned_qty DECIMAL(15,2);
BEGIN
  -- Get line item requested quantity
  SELECT requested_quantity INTO li_requested_quantity
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  -- =========================================================================
  -- L1 (quartermaster) approval inserted
  -- =========================================================================
  IF NEW.layer = 'quartermaster' THEN
    -- Calculate total L1 approved quantity for this line item
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_l1_approved_qty
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND layer = 'quartermaster'
      AND is_active = true;

    -- Calculate total rejected quantity
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_rejected_qty
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'rejected'
      AND is_active = true;

    total_decided_qty := total_l1_approved_qty + total_rejected_qty;

    IF total_l1_approved_qty >= li_requested_quantity THEN
      -- Fully covered by L1 approvals -> transition to awaiting_admin
      UPDATE stock_out_line_items
      SET status = 'awaiting_admin',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'pending';

    ELSIF total_decided_qty >= li_requested_quantity AND total_l1_approved_qty = 0 THEN
      -- Fully rejected (all decided qty is rejected, none approved) -> rejected
      UPDATE stock_out_line_items
      SET status = 'rejected',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'pending';

    -- Otherwise: still pending (partial decisions, more approvals needed)
    END IF;

  -- =========================================================================
  -- L2 (admin) approval inserted
  -- L2 decision is always 'approved' (validated by validate_sor_approval)
  -- =========================================================================
  ELSIF NEW.layer = 'admin' THEN
    -- Calculate total L1 approved qty for this line item
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_l1_approved_qty
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND layer = 'quartermaster'
      AND is_active = true;

    -- Calculate total L2 assigned qty for this line item (including the new record)
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_l2_assigned_qty
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND layer = 'admin'
      AND is_active = true;

    -- Only transition to fully_approved when ALL L1-approved qty is covered by L2.
    -- If partial assignment, remain in awaiting_admin to allow more warehouse assignments.
    IF total_l2_assigned_qty >= total_l1_approved_qty AND total_l1_approved_qty > 0 THEN
      UPDATE stock_out_line_items
      SET status = 'fully_approved',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'awaiting_admin';
    END IF;
    -- If partial L2 coverage: item stays in awaiting_admin, "Assign WH" button remains visible

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_line_item_status_on_approval() IS
  'Two-layer status update: L1 approval -> awaiting_admin when fully covered; L1 rejection -> rejected; L2 approval -> fully_approved ONLY when total L2 assigned qty covers total L1 approved qty (prevents premature fully_approved transition on partial warehouse assignment). Layer determined from NEW.layer (set by validate_sor_approval BEFORE trigger).';

-- ============================================================================
-- FIX 2: update_sor_line_item_execution_status
-- Only compare execution progress against L2 (admin layer) approved quantities,
-- since inventory_transactions are only created for L2 approvals.
-- Also handle awaiting_admin -> partially_executed for execution before full L2 coverage.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sor_line_item_execution_status()
RETURNS TRIGGER AS $$
DECLARE
  approval_record RECORD;
  total_l2_approved_for_li DECIMAL(15,2);
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

  -- Calculate total L2 (admin layer) approved qty for the line item.
  -- Inventory transactions are only linked to L2 approvals (warehouse assignments).
  -- L1 (quartermaster) approved quantities must NOT be included here because
  -- they do not have corresponding inventory_transactions.
  SELECT COALESCE(SUM(approved_quantity), 0)
  INTO total_l2_approved_for_li
  FROM stock_out_approvals
  WHERE line_item_id = li_id
    AND decision = 'approved'
    AND layer = 'admin'
    AND is_active = true;

  SELECT COALESCE(SUM(it.quantity), 0)
  INTO total_executed_for_li
  FROM inventory_transactions it
  JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id
  WHERE a.line_item_id = li_id
    AND it.movement_type = 'inventory_out'
    AND it.is_active = true
    AND it.status = 'completed';

  -- Update line item status based on execution progress.
  -- Include awaiting_admin as a valid source state for cases where execution
  -- happens before all L2 warehouse assignments are completed.
  IF total_executed_for_li >= total_l2_approved_for_li AND total_l2_approved_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('fully_approved', 'approved', 'awaiting_admin', 'partially_executed');
  ELSIF total_executed_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'partially_executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('fully_approved', 'approved', 'awaiting_admin');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_sor_line_item_execution_status() IS
  'Auto-updates line item status to partially_executed or executed based on fulfillment progress. Compares total executed quantity against L2 (admin layer) approved quantities ONLY (not L1), since inventory_transactions are linked exclusively to L2 warehouse assignments. Handles awaiting_admin -> partially_executed for execution before full L2 coverage. Recognizes both fully_approved (new two-layer flow) and approved (legacy) as valid execution start states.';

COMMIT;
