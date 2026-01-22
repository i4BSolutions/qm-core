-- Invoice Line Items Table
-- Line items for Invoices with quantity validation and PO tracking

-- Invoice Line Items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  po_line_item_id UUID NOT NULL REFERENCES po_line_items(id) ON DELETE RESTRICT,
  item_id UUID REFERENCES items(id),

  -- Quantity and pricing
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- Snapshot fields (preserves details at invoice creation time)
  item_name TEXT,
  item_sku TEXT,
  item_unit TEXT,
  po_unit_price DECIMAL(15,2), -- Reference to PO price

  -- Tracking for stock receipt
  received_quantity DECIMAL(15,2) DEFAULT 0.00,

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to validate invoice line quantity
-- Ensures quantity <= (PO quantity - already invoiced quantity)
CREATE OR REPLACE FUNCTION validate_invoice_line_quantity()
RETURNS TRIGGER AS $$
DECLARE
  po_quantity DECIMAL(15,2);
  already_invoiced DECIMAL(15,2);
  available_qty DECIMAL(15,2);
  invoice_is_voided BOOLEAN;
BEGIN
  -- Skip validation for voided invoices
  SELECT is_voided INTO invoice_is_voided
  FROM invoices
  WHERE id = NEW.invoice_id;

  IF invoice_is_voided THEN
    RETURN NEW;
  END IF;

  -- Get PO line item quantity and currently invoiced quantity
  SELECT quantity, COALESCE(invoiced_quantity, 0)
  INTO po_quantity, already_invoiced
  FROM po_line_items
  WHERE id = NEW.po_line_item_id;

  -- For updates, subtract the old quantity from already_invoiced
  IF TG_OP = 'UPDATE' THEN
    already_invoiced := already_invoiced - OLD.quantity;
  END IF;

  available_qty := po_quantity - already_invoiced;

  IF NEW.quantity > available_qty THEN
    RAISE EXCEPTION 'Invoice quantity (%) exceeds available quantity (%). PO has % units, % already invoiced.',
      NEW.quantity, available_qty, po_quantity, already_invoiced;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate invoice line quantity
DROP TRIGGER IF EXISTS invoice_line_validate_quantity ON invoice_line_items;
CREATE TRIGGER invoice_line_validate_quantity
  BEFORE INSERT OR UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_line_quantity();

-- Function to snapshot item and PO details
CREATE OR REPLACE FUNCTION snapshot_invoice_line_details()
RETURNS TRIGGER AS $$
DECLARE
  po_line RECORD;
BEGIN
  -- Get PO line item details
  SELECT item_id, item_name, item_sku, item_unit, unit_price
  INTO po_line
  FROM po_line_items
  WHERE id = NEW.po_line_item_id;

  -- Set item_id from PO line item if not provided
  IF NEW.item_id IS NULL THEN
    NEW.item_id := po_line.item_id;
  END IF;

  -- Snapshot item details if not provided
  IF NEW.item_name IS NULL THEN
    NEW.item_name := po_line.item_name;
  END IF;

  IF NEW.item_sku IS NULL THEN
    NEW.item_sku := po_line.item_sku;
  END IF;

  IF NEW.item_unit IS NULL THEN
    NEW.item_unit := po_line.item_unit;
  END IF;

  -- Always snapshot PO unit price for reference
  IF NEW.po_unit_price IS NULL THEN
    NEW.po_unit_price := po_line.unit_price;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to snapshot details
DROP TRIGGER IF EXISTS invoice_line_snapshot ON invoice_line_items;
CREATE TRIGGER invoice_line_snapshot
  BEFORE INSERT ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_invoice_line_details();

-- Function to update invoice total amount
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  target_invoice_id UUID;
  new_total DECIMAL(15,2);
BEGIN
  -- Determine the invoice to update
  IF TG_OP = 'DELETE' THEN
    target_invoice_id := OLD.invoice_id;
  ELSE
    target_invoice_id := NEW.invoice_id;
  END IF;

  -- Calculate total from all active line items
  SELECT COALESCE(SUM(total_price), 0)
  INTO new_total
  FROM invoice_line_items
  WHERE invoice_id = target_invoice_id
    AND is_active = true;

  -- Update invoice total
  UPDATE invoices
  SET total_amount = new_total,
      updated_at = NOW()
  WHERE id = target_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice total
DROP TRIGGER IF EXISTS invoice_line_update_total ON invoice_line_items;
CREATE TRIGGER invoice_line_update_total
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- Function to update PO line item invoiced_quantity
CREATE OR REPLACE FUNCTION update_po_line_invoiced_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_po_line_id UUID;
  new_invoiced_qty DECIMAL(15,2);
BEGIN
  -- Determine the PO line item to update
  IF TG_OP = 'DELETE' THEN
    target_po_line_id := OLD.po_line_item_id;
  ELSE
    target_po_line_id := NEW.po_line_item_id;
  END IF;

  -- Calculate total invoiced quantity from all non-voided invoices
  SELECT COALESCE(SUM(ili.quantity), 0)
  INTO new_invoiced_qty
  FROM invoice_line_items ili
  JOIN invoices i ON i.id = ili.invoice_id
  WHERE ili.po_line_item_id = target_po_line_id
    AND ili.is_active = true
    AND i.is_voided = false;

  -- Update PO line item
  UPDATE po_line_items
  SET invoiced_quantity = new_invoiced_qty,
      updated_at = NOW()
  WHERE id = target_po_line_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO line invoiced quantity
DROP TRIGGER IF EXISTS invoice_line_update_po_invoiced ON invoice_line_items;
CREATE TRIGGER invoice_line_update_po_invoiced
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_line_invoiced_quantity();

-- Function to recalculate PO line invoiced quantities when invoice is voided
CREATE OR REPLACE FUNCTION recalculate_po_on_invoice_void()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
    -- Recalculate all affected PO line items
    UPDATE po_line_items
    SET invoiced_quantity = (
      SELECT COALESCE(SUM(ili.quantity), 0)
      FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id
      WHERE ili.po_line_item_id = po_line_items.id
        AND ili.is_active = true
        AND i.is_voided = false
    ),
    updated_at = NOW()
    WHERE id IN (
      SELECT DISTINCT po_line_item_id
      FROM invoice_line_items
      WHERE invoice_id = NEW.id
    );

    -- Record void timestamp
    NEW.voided_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for invoice void
DROP TRIGGER IF EXISTS invoice_void_recalculate ON invoices;
CREATE TRIGGER invoice_void_recalculate
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_po_on_invoice_void();

-- Function to update line item updated_at
CREATE OR REPLACE FUNCTION update_invoice_line_item_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS invoice_line_update_timestamp ON invoice_line_items;
CREATE TRIGGER invoice_line_update_timestamp
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_line_item_timestamp();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_po_line_item_id ON invoice_line_items(po_line_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_item_id ON invoice_line_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_is_active ON invoice_line_items(is_active);

-- Comments
COMMENT ON TABLE invoice_line_items IS 'Line items for Invoices linked to PO line items';
COMMENT ON COLUMN invoice_line_items.po_line_item_id IS 'Reference to the PO line item being invoiced';
COMMENT ON COLUMN invoice_line_items.quantity IS 'Invoiced quantity (validated against available PO quantity)';
COMMENT ON COLUMN invoice_line_items.unit_price IS 'Invoice unit price (can differ from PO)';
COMMENT ON COLUMN invoice_line_items.po_unit_price IS 'Snapshot of PO unit price for reference';
COMMENT ON COLUMN invoice_line_items.received_quantity IS 'Quantity received against this invoice line (updated by stock in)';
COMMENT ON COLUMN invoice_line_items.item_name IS 'Snapshot of item name at invoice creation';
