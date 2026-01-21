-- PO Line Items Table
-- Line items for Purchase Orders with tracking fields for invoiced/received quantities

-- PO Line Items table
CREATE TABLE IF NOT EXISTS po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),

  -- Pricing
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- Tracking (for smart status calculation)
  invoiced_quantity DECIMAL(15,2) DEFAULT 0.00,
  received_quantity DECIMAL(15,2) DEFAULT 0.00,

  -- Snapshot (preserves item details at PO creation time)
  item_name TEXT,
  item_sku TEXT,
  item_unit TEXT,

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to snapshot item details on insert
CREATE OR REPLACE FUNCTION snapshot_po_line_item_details()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot if item_id is provided and name is not already set
  IF NEW.item_id IS NOT NULL AND NEW.item_name IS NULL THEN
    SELECT name, sku, default_unit
    INTO NEW.item_name, NEW.item_sku, NEW.item_unit
    FROM items
    WHERE id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to snapshot item details
DROP TRIGGER IF EXISTS po_line_item_snapshot ON po_line_items;
CREATE TRIGGER po_line_item_snapshot
  BEFORE INSERT ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_po_line_item_details();

-- Function to update PO total amount when line items change
CREATE OR REPLACE FUNCTION update_po_total()
RETURNS TRIGGER AS $$
DECLARE
  target_po_id UUID;
  new_total DECIMAL(15,2);
BEGIN
  -- Determine the PO to update
  IF TG_OP = 'DELETE' THEN
    target_po_id := OLD.po_id;
  ELSE
    target_po_id := NEW.po_id;
  END IF;

  -- Calculate total from all active line items
  SELECT COALESCE(SUM(total_price), 0)
  INTO new_total
  FROM po_line_items
  WHERE po_id = target_po_id
    AND is_active = true;

  -- Update PO total
  UPDATE purchase_orders
  SET total_amount = new_total,
      updated_at = NOW()
  WHERE id = target_po_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO total
DROP TRIGGER IF EXISTS po_line_item_update_total ON po_line_items;
CREATE TRIGGER po_line_item_update_total
  AFTER INSERT OR UPDATE OR DELETE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

-- Function to calculate and update PO smart status
CREATE OR REPLACE FUNCTION calculate_po_status(p_po_id UUID)
RETURNS po_status AS $$
DECLARE
  total_ordered DECIMAL(15,2);
  total_invoiced DECIMAL(15,2);
  total_received DECIMAL(15,2);
  current_status po_status;
  is_cancelled BOOLEAN;
BEGIN
  -- Check if PO is cancelled
  SELECT status = 'cancelled' INTO is_cancelled
  FROM purchase_orders
  WHERE id = p_po_id;

  IF is_cancelled THEN
    RETURN 'cancelled'::po_status;
  END IF;

  -- Get totals from line items
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(invoiced_quantity), 0),
    COALESCE(SUM(received_quantity), 0)
  INTO total_ordered, total_invoiced, total_received
  FROM po_line_items
  WHERE po_id = p_po_id
    AND is_active = true;

  -- Determine status based on totals
  IF total_ordered = 0 THEN
    RETURN 'not_started'::po_status;
  END IF;

  -- Check if fully matched (closed)
  IF total_received >= total_ordered AND total_invoiced >= total_ordered THEN
    RETURN 'closed'::po_status;
  END IF;

  -- Check if partially received
  IF total_received > 0 AND total_received < total_ordered THEN
    RETURN 'partially_received'::po_status;
  END IF;

  -- Check if awaiting delivery (fully invoiced but not received)
  IF total_invoiced >= total_ordered AND total_received = 0 THEN
    RETURN 'awaiting_delivery'::po_status;
  END IF;

  -- Check if partially invoiced
  IF total_invoiced > 0 AND total_invoiced < total_ordered THEN
    RETURN 'partially_invoiced'::po_status;
  END IF;

  RETURN 'not_started'::po_status;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger PO status recalculation
CREATE OR REPLACE FUNCTION trigger_update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  target_po_id UUID;
  new_status po_status;
BEGIN
  -- Determine the PO to update
  IF TG_OP = 'DELETE' THEN
    target_po_id := OLD.po_id;
  ELSE
    target_po_id := NEW.po_id;
  END IF;

  -- Calculate new status
  new_status := calculate_po_status(target_po_id);

  -- Update PO status
  UPDATE purchase_orders
  SET status = new_status,
      updated_at = NOW()
  WHERE id = target_po_id
    AND status != 'cancelled'; -- Don't update if manually cancelled

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO status when line items change
DROP TRIGGER IF EXISTS po_line_item_update_status ON po_line_items;
CREATE TRIGGER po_line_item_update_status
  AFTER INSERT OR UPDATE OR DELETE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_po_status();

-- Function to update line item updated_at
CREATE OR REPLACE FUNCTION update_po_line_item_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS po_line_item_update_timestamp ON po_line_items;
CREATE TRIGGER po_line_item_update_timestamp
  BEFORE UPDATE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_line_item_timestamp();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_item_id ON po_line_items(item_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_is_active ON po_line_items(is_active);

-- Comments
COMMENT ON TABLE po_line_items IS 'Line items for Purchase Orders';
COMMENT ON COLUMN po_line_items.total_price IS 'Generated column: quantity * unit_price';
COMMENT ON COLUMN po_line_items.invoiced_quantity IS 'Quantity that has been invoiced (updated by invoice creation)';
COMMENT ON COLUMN po_line_items.received_quantity IS 'Quantity that has been received (updated by stock in)';
COMMENT ON COLUMN po_line_items.item_name IS 'Snapshot of item name at PO creation time';
