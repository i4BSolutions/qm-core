-- Migration: 052_stock_out_requests.sql
-- Description: Create stock-out request approval workflow tables
-- Dependencies: users, items, warehouses, qmhq, inventory_transactions (stock_out_reason enum)
-- Phase: 27-stock-out-approval-db-foundation
-- Plan: 27-01

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Line item status enum (per user decision: pending -> approved/rejected/cancelled -> partially_executed -> executed)
DO $$ BEGIN
  CREATE TYPE sor_line_item_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'partially_executed',
    'executed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Computed request status enum (per user decision: derived from line items)
DO $$ BEGIN
  CREATE TYPE sor_request_status AS ENUM (
    'pending',
    'partially_approved',
    'approved',
    'rejected',
    'cancelled',
    'partially_executed',
    'executed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Stock-out requests table
CREATE TABLE IF NOT EXISTS stock_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,  -- Auto-generated: SOR-YYYY-NNNNN

  -- Computed status (derived from line items, not set directly)
  status sor_request_status NOT NULL DEFAULT 'pending',

  -- Request metadata
  reason stock_out_reason NOT NULL,  -- Reuse existing enum from 023
  notes TEXT,

  -- Optional QMHQ link (1:1 relationship per user decision)
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,

  -- Requester
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Audit fields
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock-out line items table
CREATE TABLE IF NOT EXISTS stock_out_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent request
  request_id UUID NOT NULL REFERENCES stock_out_requests(id) ON DELETE CASCADE,

  -- Item reference
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  -- Quantity
  requested_quantity DECIMAL(15,2) NOT NULL CHECK (requested_quantity > 0),

  -- Line item status (per user decision: pending -> approved/rejected/cancelled -> partially_executed -> executed)
  status sor_line_item_status NOT NULL DEFAULT 'pending',

  -- Snapshot fields (per user decision: snapshot item name and SKU at creation time)
  item_name TEXT,
  item_sku TEXT,

  -- Audit fields
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock-out approvals table
-- Per user decision: multiple approvals per line item, each for a portion (sum of all approvals <= requested qty)
CREATE TABLE IF NOT EXISTS stock_out_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent line item
  line_item_id UUID NOT NULL REFERENCES stock_out_line_items(id) ON DELETE CASCADE,

  -- Approval number: SOR-YYYY-NNNNN-A01 (auto-generated)
  approval_number TEXT UNIQUE,

  -- Approved quantity (per user decision: approved_quantity <= remaining unallotted quantity of line item)
  approved_quantity DECIMAL(15,2) NOT NULL CHECK (approved_quantity > 0),

  -- Decision
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),

  -- Rejection reason (per user decision: mandatory when rejected)
  rejection_reason TEXT,

  -- Who approved/rejected (per user decision: only admin can approve/reject)
  decided_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit fields
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: rejection_reason mandatory when rejected (per user decision)
ALTER TABLE stock_out_approvals ADD CONSTRAINT rejection_reason_required
  CHECK (decision != 'rejected' OR rejection_reason IS NOT NULL);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- stock_out_requests indexes
CREATE INDEX idx_sor_status ON stock_out_requests(status);
CREATE INDEX idx_sor_reason ON stock_out_requests(reason);
CREATE INDEX idx_sor_requester ON stock_out_requests(requester_id);
CREATE INDEX idx_sor_is_active ON stock_out_requests(is_active) WHERE is_active = true;
CREATE INDEX idx_sor_created_at ON stock_out_requests(created_at DESC);

-- UNIQUE constraint on qmhq_id (nullable unique — allows NULLs but enforces 1:1 when linked)
CREATE UNIQUE INDEX idx_stock_out_requests_qmhq_unique
  ON stock_out_requests(qmhq_id) WHERE qmhq_id IS NOT NULL;

-- stock_out_line_items indexes
CREATE INDEX idx_sor_li_request ON stock_out_line_items(request_id);
CREATE INDEX idx_sor_li_item ON stock_out_line_items(item_id);
CREATE INDEX idx_sor_li_status ON stock_out_line_items(status);
CREATE INDEX idx_sor_li_is_active ON stock_out_line_items(is_active) WHERE is_active = true;

-- stock_out_approvals indexes
CREATE INDEX idx_sor_approval_line_item ON stock_out_approvals(line_item_id);
CREATE INDEX idx_sor_approval_decided_by ON stock_out_approvals(decided_by);
CREATE INDEX idx_sor_approval_decision ON stock_out_approvals(decision);
CREATE INDEX idx_sor_approval_is_active ON stock_out_approvals(is_active) WHERE is_active = true;

-- ============================================================================
-- TRIGGERS - Updated_at
-- ============================================================================

CREATE TRIGGER update_sor_updated_at
  BEFORE UPDATE ON stock_out_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sor_li_updated_at
  BEFORE UPDATE ON stock_out_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sor_approval_updated_at
  BEFORE UPDATE ON stock_out_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ID GENERATION FUNCTIONS
-- ============================================================================

-- SOR request number generation (follows exact pattern from generate_qmrl_request_id)
CREATE OR REPLACE FUNCTION generate_sor_request_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(request_number FROM 'SOR-' || current_year || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_number
  FROM stock_out_requests
  WHERE request_number LIKE 'SOR-' || current_year || '-%';

  NEW.request_number := 'SOR-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sor_request_number ON stock_out_requests;
CREATE TRIGGER trg_generate_sor_request_number
  BEFORE INSERT ON stock_out_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION generate_sor_request_number();

-- Approval number generation (per user decision: SOR-YYYY-NNNNN-A01, A02, etc.)
CREATE OR REPLACE FUNCTION generate_sor_approval_number()
RETURNS TRIGGER AS $$
DECLARE
  parent_request_number TEXT;
  next_seq INT;
BEGIN
  -- Get the parent request number via the line item
  SELECT r.request_number
  INTO parent_request_number
  FROM stock_out_requests r
  JOIN stock_out_line_items li ON li.request_id = r.id
  WHERE li.id = NEW.line_item_id;

  -- Get next sequential approval number for this request
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(a.approval_number FROM '.*-A(\d+)$') AS INT)
  ), 0) + 1
  INTO next_seq
  FROM stock_out_approvals a
  JOIN stock_out_line_items li ON a.line_item_id = li.id
  JOIN stock_out_requests r ON li.request_id = r.id
  WHERE r.request_number = parent_request_number;

  NEW.approval_number := parent_request_number || '-A' || LPAD(next_seq::TEXT, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sor_approval_number ON stock_out_approvals;
CREATE TRIGGER trg_generate_sor_approval_number
  BEFORE INSERT ON stock_out_approvals
  FOR EACH ROW
  WHEN (NEW.approval_number IS NULL OR NEW.approval_number = '')
  EXECUTE FUNCTION generate_sor_approval_number();

-- ============================================================================
-- SNAPSHOT TRIGGER
-- ============================================================================

-- Item snapshot trigger for line items (follows pattern from snapshot_inventory_transaction_item)
CREATE OR REPLACE FUNCTION snapshot_sor_line_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_name IS NULL OR NEW.item_sku IS NULL THEN
    SELECT name, sku
    INTO NEW.item_name, NEW.item_sku
    FROM items
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_sor_line_item ON stock_out_line_items;
CREATE TRIGGER trg_snapshot_sor_line_item
  BEFORE INSERT ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_sor_line_item();

-- ============================================================================
-- COMPUTED STATUS TRIGGER
-- ============================================================================

-- Computed request status trigger (per user decision: SOR request status computed from line items)
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

  -- Count line item statuses
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

-- Trigger on line items status change
DROP TRIGGER IF EXISTS trg_compute_sor_status_from_li ON stock_out_line_items;
CREATE TRIGGER trg_compute_sor_status_from_li
  AFTER INSERT OR UPDATE OF status, is_active OR DELETE ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_sor_request_status();

-- ============================================================================
-- QMHQ CONSTRAINT TRIGGER
-- ============================================================================

-- NOTE: This constraint was REMOVED in migration 20260210075851
-- Original implementation (Phase 27-01) incorrectly restricted QMHQ-linked SORs to one line item
-- QMHQ item routes can legitimately have multiple line items, so this restriction was wrong

-- QMHQ single-line-item enforcement (per user decision: QMHQ-linked SOR always has exactly one line item)
-- DEPRECATED: This function and trigger are no longer active
CREATE OR REPLACE FUNCTION enforce_qmhq_single_line_item()
RETURNS TRIGGER AS $$
DECLARE
  linked_qmhq_id UUID;
  existing_count INT;
BEGIN
  -- Check if the parent request is linked to a QMHQ
  SELECT qmhq_id INTO linked_qmhq_id
  FROM stock_out_requests
  WHERE id = NEW.request_id;

  IF linked_qmhq_id IS NOT NULL THEN
    -- Count existing active line items (excluding current if update)
    SELECT COUNT(*) INTO existing_count
    FROM stock_out_line_items
    WHERE request_id = NEW.request_id
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF existing_count >= 1 THEN
      RAISE EXCEPTION 'QMHQ-linked stock-out requests can only have one line item';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_qmhq_single_line_item ON stock_out_line_items;
CREATE TRIGGER trg_enforce_qmhq_single_line_item
  BEFORE INSERT ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_qmhq_single_line_item();

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE stock_out_requests IS 'Stock-out request requiring approval before inventory can be withdrawn';
COMMENT ON TABLE stock_out_line_items IS 'Individual items within a stock-out request, each with own approval status';
COMMENT ON TABLE stock_out_approvals IS 'Approval/rejection decisions on stock-out line items, supports partial approval';
COMMENT ON COLUMN stock_out_requests.status IS 'Computed from line item statuses, not set directly';
COMMENT ON COLUMN stock_out_requests.qmhq_id IS 'Optional 1:1 link to QMHQ item route (NULL for standalone requests). Multiple line items are allowed even when linked to QMHQ.';
COMMENT ON COLUMN stock_out_line_items.requested_quantity IS 'Quantity requested for stock-out, approval can be for less';
COMMENT ON COLUMN stock_out_approvals.approved_quantity IS 'Quantity approved in this approval (sum of approvals per line item must not exceed requested_quantity)';
COMMENT ON COLUMN stock_out_approvals.approval_number IS 'Auto-generated: parent SOR number + sequential suffix (SOR-YYYY-NNNNN-A01)';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT USAGE ON TYPE sor_line_item_status TO authenticated;
GRANT USAGE ON TYPE sor_request_status TO authenticated;
