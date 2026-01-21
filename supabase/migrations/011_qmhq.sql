-- QMHQ (Request Line / Headquarters) Table
-- Each QMHQ belongs to a QMRL and has one of three route types: item, expense, po

-- Create route_type enum
DO $$ BEGIN
  CREATE TYPE route_type AS ENUM ('item', 'expense', 'po');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- QMHQ table
CREATE TABLE IF NOT EXISTS qmhq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE, -- Auto-generated: QMHQ-YYYY-NNNNN

  -- Parent reference
  qmrl_id UUID NOT NULL REFERENCES qmrl(id) ON DELETE CASCADE,

  -- Basic info
  line_name TEXT NOT NULL, -- Title/name of this QMHQ line
  description TEXT,
  notes TEXT,

  -- Route type (determines which fields are used)
  route_type route_type NOT NULL,

  -- Classification
  status_id UUID REFERENCES status_config(id),
  category_id UUID REFERENCES categories(id),

  -- Contacts
  contact_person_id UUID REFERENCES contact_persons(id),
  assigned_to UUID REFERENCES users(id),

  -- Item Route fields (route_type = 'item')
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(15,2),
  warehouse_id UUID REFERENCES warehouses(id), -- Target warehouse for stock out

  -- Expense/PO Route financial fields (route_type = 'expense' or 'po')
  amount DECIMAL(15,2), -- Budget amount for PO route, expense amount for expense route
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN amount / exchange_rate ELSE 0 END
  ) STORED,

  -- PO Route specific - Balance tracking (calculated/updated via triggers)
  total_money_in DECIMAL(15,2) DEFAULT 0.00,
  total_po_committed DECIMAL(15,2) DEFAULT 0.00,
  balance_in_hand DECIMAL(15,2) GENERATED ALWAYS AS (
    total_money_in - total_po_committed
  ) STORED,

  -- Soft delete
  is_active BOOLEAN DEFAULT true,

  -- Timestamps and audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Create function to generate QMHQ request_id
CREATE OR REPLACE FUNCTION generate_qmhq_request_id()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(request_id FROM 'QMHQ-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM qmhq
  WHERE request_id LIKE 'QMHQ-' || year_part || '-%';

  -- Format: QMHQ-YYYY-NNNNN
  new_id := 'QMHQ-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');

  NEW.request_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request_id
DROP TRIGGER IF EXISTS qmhq_generate_request_id ON qmhq;
CREATE TRIGGER qmhq_generate_request_id
  BEFORE INSERT ON qmhq
  FOR EACH ROW
  WHEN (NEW.request_id IS NULL)
  EXECUTE FUNCTION generate_qmhq_request_id();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_qmhq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qmhq_update_timestamp ON qmhq;
CREATE TRIGGER qmhq_update_timestamp
  BEFORE UPDATE ON qmhq
  FOR EACH ROW
  EXECUTE FUNCTION update_qmhq_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qmhq_qmrl_id ON qmhq(qmrl_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_status_id ON qmhq(status_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_category_id ON qmhq(category_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_assigned_to ON qmhq(assigned_to);
CREATE INDEX IF NOT EXISTS idx_qmhq_route_type ON qmhq(route_type);
CREATE INDEX IF NOT EXISTS idx_qmhq_item_id ON qmhq(item_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_is_active ON qmhq(is_active);
CREATE INDEX IF NOT EXISTS idx_qmhq_created_at ON qmhq(created_at DESC);

-- Comments
COMMENT ON TABLE qmhq IS 'QMHQ (Request Lines) - Each line belongs to a QMRL and has a specific route type';
COMMENT ON COLUMN qmhq.route_type IS 'item: Issue from warehouse, expense: Direct money in/out, po: Purchase via PO flow';
COMMENT ON COLUMN qmhq.amount IS 'For expense route: expense amount. For PO route: budget amount';
COMMENT ON COLUMN qmhq.balance_in_hand IS 'PO Route only: total_money_in - total_po_committed';
