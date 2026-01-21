-- Purchase Orders Table
-- Creates Purchase Orders linked to QMHQ records with PO route type

-- Create approval_status enum
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('draft', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create po_status enum
DO $$ BEGIN
  CREATE TYPE po_status AS ENUM (
    'not_started',
    'partially_invoiced',
    'awaiting_delivery',
    'partially_received',
    'closed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE, -- Auto-generated: PO-YYYY-NNNNN

  -- Parent reference (only for PO route QMHQ)
  qmhq_id UUID NOT NULL REFERENCES qmhq(id) ON DELETE RESTRICT,

  -- Supplier
  supplier_id UUID REFERENCES suppliers(id),

  -- Dates
  po_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,

  -- Currency (independent from QMHQ)
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

  -- Signer fields
  contact_person_name TEXT,
  sign_person_name TEXT,
  authorized_signer_name TEXT,

  -- Totals (updated via trigger from line items)
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN total_amount / exchange_rate ELSE 0 END
  ) STORED,

  -- Smart Status (auto-calculated)
  status po_status DEFAULT 'not_started',
  approval_status approval_status DEFAULT 'draft',

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps and audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Function to generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(po_number FROM 'PO-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_part || '-%';

  -- Format: PO-YYYY-NNNNN
  new_id := 'PO-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');

  NEW.po_number := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate po_number
DROP TRIGGER IF EXISTS po_generate_po_number ON purchase_orders;
CREATE TRIGGER po_generate_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();

-- Function to validate QMHQ route type is 'po'
CREATE OR REPLACE FUNCTION validate_po_qmhq_route()
RETURNS TRIGGER AS $$
DECLARE
  qmhq_route route_type;
BEGIN
  SELECT route_type INTO qmhq_route
  FROM qmhq
  WHERE id = NEW.qmhq_id;

  IF qmhq_route != 'po' THEN
    RAISE EXCEPTION 'Purchase Orders can only be created for QMHQ records with route_type = po';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate QMHQ route type
DROP TRIGGER IF EXISTS po_validate_qmhq_route ON purchase_orders;
CREATE TRIGGER po_validate_qmhq_route
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_po_qmhq_route();

-- Function to update QMHQ total_po_committed when PO is created/updated/cancelled
CREATE OR REPLACE FUNCTION update_qmhq_po_committed()
RETURNS TRIGGER AS $$
DECLARE
  target_qmhq_id UUID;
  new_total DECIMAL(15,2);
BEGIN
  -- Determine the QMHQ to update
  IF TG_OP = 'DELETE' THEN
    target_qmhq_id := OLD.qmhq_id;
  ELSE
    target_qmhq_id := NEW.qmhq_id;
  END IF;

  -- Calculate total from all active, non-cancelled POs
  SELECT COALESCE(SUM(total_amount_eusd), 0)
  INTO new_total
  FROM purchase_orders
  WHERE qmhq_id = target_qmhq_id
    AND is_active = true
    AND status != 'cancelled';

  -- Update QMHQ
  UPDATE qmhq
  SET total_po_committed = new_total,
      updated_at = NOW()
  WHERE id = target_qmhq_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update QMHQ.total_po_committed
DROP TRIGGER IF EXISTS po_update_qmhq_committed ON purchase_orders;
CREATE TRIGGER po_update_qmhq_committed
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_qmhq_po_committed();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_po_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS po_update_timestamp ON purchase_orders;
CREATE TRIGGER po_update_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_po_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_qmhq_id ON purchase_orders(qmhq_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_approval_status ON purchase_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_is_active ON purchase_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_date ON purchase_orders(po_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

-- Comments
COMMENT ON TABLE purchase_orders IS 'Purchase Orders created from QMHQ with PO route type';
COMMENT ON COLUMN purchase_orders.po_number IS 'Auto-generated: PO-YYYY-NNNNN format';
COMMENT ON COLUMN purchase_orders.status IS 'Smart status auto-calculated based on invoice/receiving progress';
COMMENT ON COLUMN purchase_orders.total_amount IS 'Sum of all line item totals (updated via trigger)';
COMMENT ON COLUMN purchase_orders.total_amount_eusd IS 'Total amount in EUSD (generated column)';
