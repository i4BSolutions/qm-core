-- Migration: 20260217100000_two_layer_approval_schema.sql
-- Description: Two-layer approval schema: layer + parent_approval_id + warehouse_id columns
--              on stock_out_approvals, sor_line_item_status enum extension (awaiting_admin,
--              fully_approved), trigger rewrites for two-layer flow, and data backfill.
-- Dependencies: 052_stock_out_requests, 053_stock_out_validation, 058_advisory_lock_stock_validation,
--               059_row_lock_status_aggregation, 20260211103947_fix_line_item_status_rejection_qty
-- Phase: 55-database-foundation-useravatar
-- Plan: 55-01
-- Requirement: APPR-06

-- NOTE: Enum extension (awaiting_admin, fully_approved) is in the preceding
-- migration 20260217099999_two_layer_enum_extension.sql. PostgreSQL requires
-- new enum values to be committed in a separate transaction before use.

BEGIN;

-- ============================================================================
-- STEP 2a: ADD COLUMNS TO stock_out_approvals
-- ============================================================================

-- layer: identifies which approval layer this record belongs to.
-- L1 = 'quartermaster' (quantity approval), L2 = 'admin' (warehouse assignment).
-- NULL is allowed for rejected records (terminal state, never executed).
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS layer TEXT CHECK (layer IN ('quartermaster', 'admin'));

-- parent_approval_id: L2 approvals reference their L1 parent.
-- NULL for L1 approvals. Self-referencing foreign key.
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS parent_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL;

-- warehouse_id: L2 approvals assign a specific warehouse for stock pickup.
-- NULL for L1 approvals (no warehouse assigned at L1 level).
-- Required (enforced by trigger) for L2 approvals.
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT;

-- ============================================================================
-- STEP 2b: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sor_approval_layer
  ON stock_out_approvals(layer);

CREATE INDEX IF NOT EXISTS idx_sor_approval_parent
  ON stock_out_approvals(parent_approval_id)
  WHERE parent_approval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sor_approval_warehouse
  ON stock_out_approvals(warehouse_id)
  WHERE warehouse_id IS NOT NULL;

-- ============================================================================
-- STEP 3: TRIGGER FUNCTION REWRITES
-- Order matters: validate_sor_line_item_status_transition MUST be rewritten
-- FIRST because the backfill UPDATE changes status from 'approved' to
-- 'fully_approved', and the old guard blocks that transition.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3a. validate_sor_line_item_status_transition()
-- Rewrites the transition guard to allow the new two-layer flow.
-- Also allows approved -> fully_approved for the backfill in this migration.
-- ----------------------------------------------------------------------------
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
      -- awaiting_admin can only go to fully_approved (L2 warehouse assignment)
      IF NEW.status NOT IN ('fully_approved') THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Items awaiting admin assignment can only transition to fully_approved.',
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
  'Enforces valid status transitions for stock-out line items in the two-layer approval flow: pending -> awaiting_admin -> fully_approved -> execution.';

-- ----------------------------------------------------------------------------
-- 3b. validate_sor_approval()
-- Layer-aware approval validation with advisory lock for L2 warehouse stock check.
-- Rewrites the version from migrations 053 + 058 to handle L1 and L2 separately.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_sor_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  li_item_id UUID;
  total_already_approved DECIMAL(15,2);
  available_stock DECIMAL(15,2);
  l1_approval RECORD;
  lock_key BIGINT;
BEGIN
  -- Get line item details
  SELECT requested_quantity, item_id
  INTO li_requested_quantity, li_item_id
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  -- Auto-assign layer based on parent_approval_id:
  -- L1 (quartermaster): no parent approval
  -- L2 (admin): has a parent approval
  IF NEW.parent_approval_id IS NULL THEN
    NEW.layer := 'quartermaster';
  ELSE
    NEW.layer := 'admin';
  END IF;

  -- =========================================================================
  -- L1 (quartermaster) approval validation
  -- =========================================================================
  IF NEW.layer = 'quartermaster' THEN
    -- warehouse_id must be NULL for L1 approvals
    IF NEW.warehouse_id IS NOT NULL THEN
      RAISE EXCEPTION 'Layer 1 (quartermaster) approvals must not specify a warehouse. Use Layer 2 (admin) for warehouse assignment.';
    END IF;

    -- For approved decisions: validate quantity and stock
    IF NEW.decision = 'approved' THEN
      -- Sum of existing L1 approved quantities for this line item
      SELECT COALESCE(SUM(approved_quantity), 0)
      INTO total_already_approved
      FROM stock_out_approvals
      WHERE line_item_id = NEW.line_item_id
        AND decision = 'approved'
        AND layer = 'quartermaster'
        AND is_active = true
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

      IF (total_already_approved + NEW.approved_quantity) > li_requested_quantity THEN
        RAISE EXCEPTION 'Total L1 approved quantity (% + %) exceeds requested quantity (%)',
          total_already_approved, NEW.approved_quantity, li_requested_quantity;
      END IF;

      -- Acquire advisory lock on item to serialize concurrent L1 approvals
      lock_key := hashtext(li_item_id::text);
      PERFORM pg_advisory_xact_lock(lock_key);

      -- Validate total stock availability across all warehouses
      available_stock := get_total_item_stock(li_item_id);

      IF NEW.approved_quantity > available_stock THEN
        RAISE EXCEPTION 'L1 approved quantity (%) exceeds available stock across all warehouses (%)',
          NEW.approved_quantity, available_stock;
      END IF;

    ELSIF NEW.decision = 'rejected' THEN
      -- rejection_reason is required — enforced by existing CHECK constraint
      -- (decision != 'rejected' OR rejection_reason IS NOT NULL)
      NULL; -- No additional validation beyond constraint
    END IF;

  -- =========================================================================
  -- L2 (admin) approval validation
  -- =========================================================================
  ELSIF NEW.layer = 'admin' THEN
    -- L2 decisions are always 'approved' — no reject option at this layer
    IF NEW.decision != 'approved' THEN
      RAISE EXCEPTION 'Layer 2 (admin) approvals must have decision = ''approved''. Layer 2 is a warehouse assignment step with no reject option.';
    END IF;

    -- warehouse_id is required for L2 approvals
    IF NEW.warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Layer 2 (admin) approvals require a warehouse_id for warehouse assignment.';
    END IF;

    -- Validate parent_approval_id points to a valid L1 approval
    SELECT id, approved_quantity, decision, layer
    INTO l1_approval
    FROM stock_out_approvals
    WHERE id = NEW.parent_approval_id
      AND is_active = true;

    IF l1_approval.id IS NULL THEN
      RAISE EXCEPTION 'Layer 2 approval references non-existent parent approval (id: %)', NEW.parent_approval_id;
    END IF;

    IF l1_approval.decision != 'approved' THEN
      RAISE EXCEPTION 'Layer 2 approval requires an approved Layer 1 parent. Parent approval % has decision = ''%''.',
        NEW.parent_approval_id, l1_approval.decision;
    END IF;

    IF l1_approval.layer != 'quartermaster' THEN
      RAISE EXCEPTION 'Layer 2 approval parent must be a Layer 1 (quartermaster) approval. Parent layer = ''%''.',
        l1_approval.layer;
    END IF;

    -- L2 approved_quantity must not exceed L1 parent's approved_quantity
    IF NEW.approved_quantity > l1_approval.approved_quantity THEN
      RAISE EXCEPTION 'Layer 2 approved quantity (%) exceeds Layer 1 parent approved quantity (%)',
        NEW.approved_quantity, l1_approval.approved_quantity;
    END IF;

    -- Acquire advisory lock on item+warehouse combination to serialize
    -- concurrent L2 approvals for the same warehouse
    lock_key := hashtext(li_item_id::text || NEW.warehouse_id::text);
    PERFORM pg_advisory_xact_lock(lock_key);

    -- Validate warehouse-specific stock availability
    available_stock := get_warehouse_stock(li_item_id, NEW.warehouse_id);

    IF NEW.approved_quantity > available_stock THEN
      RAISE EXCEPTION 'Layer 2 approved quantity (%) exceeds available warehouse stock for this item (warehouse stock: %)',
        NEW.approved_quantity, available_stock;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_sor_approval() IS
  'Layer-aware approval validation: L1 (quartermaster) checks total stock, L2 (admin) checks warehouse stock and L1 qty cap. Auto-assigns layer from parent_approval_id. Uses advisory locks (not FOR UPDATE) to avoid deadlocks with migration 059.';

DROP TRIGGER IF EXISTS trg_validate_sor_approval ON stock_out_approvals;
CREATE TRIGGER trg_validate_sor_approval
  BEFORE INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_approval();

-- ----------------------------------------------------------------------------
-- 3c. update_line_item_status_on_approval()
-- Rewrites the latest version from 20260211103947 to handle two-layer flow.
-- L1 approval -> awaiting_admin (when fully covered)
-- L2 approval -> fully_approved
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_l1_approved_qty DECIMAL(15,2);
  total_rejected_qty DECIMAL(15,2);
  total_decided_qty DECIMAL(15,2);
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
    -- Transition from awaiting_admin -> fully_approved
    UPDATE stock_out_line_items
    SET status = 'fully_approved',
        updated_by = NEW.decided_by,
        updated_at = NOW()
    WHERE id = NEW.line_item_id
      AND status = 'awaiting_admin';

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_line_item_status_on_approval() IS
  'Two-layer status update: L1 approval -> awaiting_admin when fully covered; L1 rejection -> rejected; L2 approval -> fully_approved. Layer determined from NEW.layer (set by validate_sor_approval BEFORE trigger).';

DROP TRIGGER IF EXISTS trg_update_li_status_on_approval ON stock_out_approvals;
CREATE TRIGGER trg_update_li_status_on_approval
  AFTER INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_line_item_status_on_approval();

-- ----------------------------------------------------------------------------
-- 3d. validate_sor_fulfillment()
-- Updates the advisory-lock-protected version from migration 058 to require
-- BOTH layer='admin' AND decision='approved' for execution.
-- Only L2 (admin layer) approvals can be executed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_sor_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  approval_qty DECIMAL(15,2);
  total_executed DECIMAL(15,2);
  approval_decision TEXT;
  approval_layer TEXT;
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
  -- Prevents over-execution when multiple transactions fulfill the same approval
  lock_key := hashtext(NEW.stock_out_approval_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Get approval details including layer
  SELECT approved_quantity, decision, layer
  INTO approval_qty, approval_decision, approval_layer
  FROM stock_out_approvals
  WHERE id = NEW.stock_out_approval_id
    AND is_active = true;

  IF approval_qty IS NULL THEN
    RAISE EXCEPTION 'Stock-out approval not found';
  END IF;

  -- Only Layer 2 (admin) approvals with decision='approved' can be executed
  IF approval_decision != 'approved' OR approval_layer != 'admin' THEN
    RAISE EXCEPTION 'Cannot fulfill: only Layer 2 (admin) approved stock-out approvals can be executed. This approval has decision=''%'', layer=''%''.',
      approval_decision, COALESCE(approval_layer, 'NULL');
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
  'Validates stock-out approval execution: requires layer=''admin'' AND decision=''approved''. Uses advisory lock to prevent over-execution from concurrent transactions.';

-- Note: The trigger trg_validate_sor_fulfillment on inventory_transactions
-- already exists from migration 058. CREATE OR REPLACE on the function updates
-- the behavior; no need to recreate the trigger.

-- ----------------------------------------------------------------------------
-- 3e. compute_sor_request_status()
-- Updates the row-lock version from migration 059 to count awaiting_admin
-- and fully_approved statuses in the aggregation logic.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_sor_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
  pending_count INT;
  cancelled_count INT;
  rejected_count INT;
  awaiting_admin_count INT;
  fully_approved_count INT;
  approved_count INT;       -- legacy: backfilled records (should be 0 after migration)
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
    COUNT(*) FILTER (WHERE status = 'awaiting_admin'),
    COUNT(*) FILTER (WHERE status = 'fully_approved'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'partially_executed'),
    COUNT(*) FILTER (WHERE status = 'executed')
  INTO total_count, pending_count, cancelled_count, rejected_count,
       awaiting_admin_count, fully_approved_count, approved_count,
       partially_executed_count, executed_count
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

  ELSIF (fully_approved_count + approved_count) = total_count THEN
    -- All lines are execution-ready (fully_approved = new; approved = legacy backfilled)
    new_status := 'approved';

  ELSIF (fully_approved_count + approved_count + awaiting_admin_count) > 0 AND pending_count = 0 THEN
    -- All decided but mix of awaiting_admin and fully_approved states
    new_status := 'partially_approved';

  ELSIF (fully_approved_count + approved_count + awaiting_admin_count) > 0 AND pending_count > 0 THEN
    -- Some decided but still pending items
    new_status := 'partially_approved';

  ELSE
    -- Mixed states: some rejected/cancelled with no pending — fallback
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
  'Computes parent stock-out request status from child line item statuses. Handles two-layer approval states: awaiting_admin, fully_approved. Uses row-level locking to prevent stale reads.';

-- Note: The triggers trg_compute_sor_status_from_li and
-- trg_compute_sor_status_from_approval already exist from migrations 052/059.
-- CREATE OR REPLACE on the function updates behavior without recreating triggers.

-- ----------------------------------------------------------------------------
-- 3f. update_sor_line_item_execution_status()
-- Updates execution status trigger to recognize fully_approved (and legacy
-- approved) as valid starting states for execution transitions.
-- ----------------------------------------------------------------------------
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
  -- Include both 'fully_approved' (new) and 'approved' (legacy) layer decisions
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
  -- Recognize both fully_approved (new flow) and approved (legacy) as valid start states
  IF total_executed_for_li >= total_approved_for_li AND total_approved_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('fully_approved', 'approved', 'partially_executed');
  ELSIF total_executed_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'partially_executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('fully_approved', 'approved');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_sor_line_item_execution_status() IS
  'Auto-updates line item status to partially_executed or executed based on fulfillment progress. Recognizes both fully_approved (new two-layer flow) and approved (legacy) as valid execution start states.';

-- ============================================================================
-- STEP 4: DATA BACKFILL (after trigger rewrites — transition guard now allows
-- approved -> fully_approved, so this runs cleanly)
-- ============================================================================

-- Backfill layer on approved approvals: all approved records were effectively
-- single-layer "admin" approvals before the two-layer system was introduced.
UPDATE stock_out_approvals
SET layer = 'admin',
    updated_at = NOW()
WHERE decision = 'approved'
  AND layer IS NULL
  AND is_active = true;

-- Backfill rejected approvals: assigned to quartermaster layer as they
-- represent L1 rejection decisions.
UPDATE stock_out_approvals
SET layer = 'quartermaster',
    updated_at = NOW()
WHERE decision = 'rejected'
  AND layer IS NULL
  AND is_active = true;

-- Backfill line item status: approved -> fully_approved
-- All existing 'approved' line items were single-layer approved and are
-- ready for execution. Map them to 'fully_approved' to unblock execution
-- (validate_sor_fulfillment now requires layer='admin').
UPDATE stock_out_line_items
SET status = 'fully_approved',
    updated_at = NOW()
WHERE status = 'approved'
  AND is_active = true;

-- ============================================================================
-- STEP 5: COLUMN COMMENTS + PERMISSIONS
-- ============================================================================

COMMENT ON COLUMN stock_out_approvals.layer IS
  'Approval layer: ''quartermaster'' = L1 quantity approval, ''admin'' = L2 warehouse assignment. Auto-set by validate_sor_approval trigger. NULL for rejected records without layer context.';

COMMENT ON COLUMN stock_out_approvals.parent_approval_id IS
  'Self-reference: L2 (admin) approvals link to their L1 (quartermaster) parent. NULL for L1 approvals. Used for qty cap enforcement (L2 qty <= L1 approved qty).';

COMMENT ON COLUMN stock_out_approvals.warehouse_id IS
  'Target warehouse for stock pickup. Required for L2 (admin) approvals, NULL for L1 approvals. Enforced by validate_sor_approval trigger.';

GRANT SELECT, INSERT, UPDATE ON stock_out_approvals TO authenticated;

COMMIT;
