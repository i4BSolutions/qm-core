-- Migration: 20260219000000_remove_l1_stock_check.sql
-- Description: Remove warehouse stock check from L1 (quartermaster) approval validation.
--              L1 approval is a quantity-only decision — it should never be blocked by stock
--              levels. Stock availability is only relevant at L2 (warehouse assignment), where
--              a specific warehouse must provide the goods. At L1, the approver is simply
--              authorising the quantity; the warehouse sourcing happens at L2.
--
--              Change: In validate_sor_approval(), remove the advisory lock and
--              get_total_item_stock() call from the L1 (quartermaster) branch.
--              The remaining L1 validations are kept:
--                - warehouse_id must be NULL for L1
--                - approved_quantity + existing L1 approved must not exceed requested_quantity
--              L2 validations are unchanged.
--
-- Dependencies: 20260217100000_two_layer_approval_schema.sql (defines current version)
-- Phase: bug-fix (sor-l1-approval-warehouse-restriction)

BEGIN;

-- ============================================================================
-- Replace validate_sor_approval() — remove L1 stock check
-- ============================================================================

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
  --   - parent_approval_id IS NULL  -> layer = 'quartermaster' (L1)
  --   - parent_approval_id IS NOT NULL -> layer = 'admin' (L2)
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

    -- For approved decisions: validate quantity does not exceed requested
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

      -- NOTE: Stock availability is intentionally NOT checked at L1.
      -- L1 is a quantity-only approval decision. The approver authorises the
      -- quantity requested; warehouse stock sourcing is handled at L2 (admin)
      -- when a specific warehouse is assigned. This allows L1 approval even
      -- when stock is currently zero — procurement can be initiated in parallel.

    ELSIF NEW.decision = 'rejected' THEN
      -- Rejected decisions are valid at L1; no additional validation required
      NULL;
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
      RAISE EXCEPTION 'Layer 2 approval references non-existent or inactive parent approval (id: %)',
        NEW.parent_approval_id;
    END IF;

    IF l1_approval.decision != 'approved' OR l1_approval.layer != 'quartermaster' THEN
      RAISE EXCEPTION 'Layer 2 approval parent must be an approved Layer 1 (quartermaster) approval. Found: decision=''%'', layer=''%''',
        l1_approval.decision,
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
  'Layer-aware approval validation: L1 (quartermaster) checks quantity cap only (no stock check — stock is irrelevant at L1, approver is authorising quantity not sourcing warehouse stock). L2 (admin) checks warehouse stock and L1 qty cap. Auto-assigns layer from parent_approval_id. Uses advisory lock at L2 only.';

-- The trigger already exists (created in 20260217100000_two_layer_approval_schema.sql).
-- CREATE OR REPLACE on the function above is sufficient — no need to recreate the trigger.

COMMIT;
