-- Invoices Table
-- Creates Invoices linked to Purchase Orders for tracking goods receipt

-- Create invoice_status enum if not exists
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft',
    'received',
    'partially_received',
    'completed',
    'voided'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE, -- Auto-generated: INV-YYYY-NNNNN

  -- Parent PO reference
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,

  -- Supplier invoice details
  supplier_invoice_no TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  received_date DATE,

  -- Currency (independent from PO - can differ)
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

  -- Totals (updated via trigger from line items)
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN total_amount / exchange_rate ELSE 0 END
  ) STORED,

  -- Status
  status invoice_status DEFAULT 'draft',

  -- Void fields (soft delete pattern)
  is_voided BOOLEAN DEFAULT false,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT,

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps and audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Function to generate invoice number (INV-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'INV-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';

  -- Format: INV-YYYY-NNNNN
  new_id := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');

  NEW.invoice_number := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice_number
DROP TRIGGER IF EXISTS invoice_generate_number ON invoices;
CREATE TRIGGER invoice_generate_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- Function to block invoice creation for closed/cancelled POs
CREATE OR REPLACE FUNCTION block_invoice_for_closed_po()
RETURNS TRIGGER AS $$
DECLARE
  po_status_val po_status;
BEGIN
  SELECT status INTO po_status_val
  FROM purchase_orders
  WHERE id = NEW.po_id;

  IF po_status_val = 'closed' THEN
    RAISE EXCEPTION 'Cannot create invoice for a closed Purchase Order';
  END IF;

  IF po_status_val = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot create invoice for a cancelled Purchase Order';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to block invoice for closed PO
DROP TRIGGER IF EXISTS invoice_block_closed_po ON invoices;
CREATE TRIGGER invoice_block_closed_po
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION block_invoice_for_closed_po();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS invoice_update_timestamp ON invoices;
CREATE TRIGGER invoice_update_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_po_id ON invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_is_voided ON invoices(is_voided);
CREATE INDEX IF NOT EXISTS idx_invoices_is_active ON invoices(is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Comments
COMMENT ON TABLE invoices IS 'Invoices created against Purchase Orders for goods receipt tracking';
COMMENT ON COLUMN invoices.invoice_number IS 'Auto-generated: INV-YYYY-NNNNN format';
COMMENT ON COLUMN invoices.supplier_invoice_no IS 'External supplier invoice reference number';
COMMENT ON COLUMN invoices.currency IS 'Invoice currency (independent from PO)';
COMMENT ON COLUMN invoices.exchange_rate IS 'Exchange rate for EUSD calculation (independent from PO)';
COMMENT ON COLUMN invoices.total_amount IS 'Sum of all line item totals (updated via trigger)';
COMMENT ON COLUMN invoices.total_amount_eusd IS 'Total amount in EUSD (generated column)';
COMMENT ON COLUMN invoices.is_voided IS 'Soft delete flag - voided invoices excluded from calculations';
