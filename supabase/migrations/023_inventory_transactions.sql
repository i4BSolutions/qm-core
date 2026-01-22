-- Migration: 023_inventory_transactions.sql
-- Description: Create inventory_transactions table for stock in/out tracking

-- Movement type enum (already defined in database.ts, adding if not exists)
DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM ('inventory_in', 'inventory_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Stock out reason enum (already defined in database.ts, adding if not exists)
DO $$ BEGIN
  CREATE TYPE stock_out_reason AS ENUM ('request', 'consumption', 'damage', 'lost', 'transfer', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Transaction status enum
DO $$ BEGIN
  CREATE TYPE inventory_transaction_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Inventory Transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Movement type
  movement_type movement_type NOT NULL,

  -- Core references
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

  -- Quantity (always positive, movement_type determines direction)
  quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),

  -- Cost tracking (for WAC calculation on inventory_in)
  unit_cost DECIMAL(15,2),
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  unit_cost_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE
      WHEN exchange_rate > 0 AND unit_cost IS NOT NULL
      THEN ROUND(unit_cost / exchange_rate, 2)
      ELSE NULL
    END
  ) STORED,

  -- Total cost (quantity * unit_cost)
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE
      WHEN unit_cost IS NOT NULL
      THEN ROUND(quantity * unit_cost, 2)
      ELSE NULL
    END
  ) STORED,
  total_cost_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE
      WHEN exchange_rate > 0 AND unit_cost IS NOT NULL
      THEN ROUND((quantity * unit_cost) / exchange_rate, 2)
      ELSE NULL
    END
  ) STORED,

  -- Stock out reason (only for inventory_out)
  reason stock_out_reason,

  -- Transfer destination (only when reason = 'transfer')
  destination_warehouse_id UUID REFERENCES warehouses(id),

  -- Source references
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL,
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,

  -- Transaction info
  status inventory_transaction_status DEFAULT 'completed',
  transaction_date DATE DEFAULT CURRENT_DATE,
  reference_no TEXT,
  notes TEXT,

  -- Snapshot fields (preserves item details at transaction time)
  item_name TEXT,
  item_sku TEXT,

  -- Audit fields
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE inventory_transactions ADD CONSTRAINT check_transfer_destination
  CHECK (
    reason != 'transfer' OR destination_warehouse_id IS NOT NULL
  );

ALTER TABLE inventory_transactions ADD CONSTRAINT check_different_warehouses
  CHECK (
    destination_warehouse_id IS NULL OR destination_warehouse_id != warehouse_id
  );

ALTER TABLE inventory_transactions ADD CONSTRAINT check_reason_for_out
  CHECK (
    movement_type != 'inventory_out' OR reason IS NOT NULL
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id
  ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_warehouse_id
  ON inventory_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_movement_type
  ON inventory_transactions(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_transaction_date
  ON inventory_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_id
  ON inventory_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_line_item_id
  ON inventory_transactions(invoice_line_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_qmhq_id
  ON inventory_transactions(qmhq_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_status
  ON inventory_transactions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_is_active
  ON inventory_transactions(is_active) WHERE is_active = true;

-- Updated at trigger
CREATE TRIGGER update_inventory_transactions_updated_at
  BEFORE UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to snapshot item details on transaction creation
CREATE OR REPLACE FUNCTION snapshot_inventory_transaction_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Snapshot item details if not provided
  IF NEW.item_name IS NULL OR NEW.item_sku IS NULL THEN
    SELECT name, sku
    INTO NEW.item_name, NEW.item_sku
    FROM items
    WHERE id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to snapshot item details
DROP TRIGGER IF EXISTS inventory_transaction_snapshot_item ON inventory_transactions;
CREATE TRIGGER inventory_transaction_snapshot_item
  BEFORE INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_inventory_transaction_item();

-- Comments
COMMENT ON TABLE inventory_transactions IS 'Records all inventory movements (stock in/out)';
COMMENT ON COLUMN inventory_transactions.movement_type IS 'Type of movement: inventory_in (stock received) or inventory_out (stock issued)';
COMMENT ON COLUMN inventory_transactions.quantity IS 'Quantity moved (always positive, direction determined by movement_type)';
COMMENT ON COLUMN inventory_transactions.unit_cost IS 'Cost per unit (used for WAC calculation on inventory_in)';
COMMENT ON COLUMN inventory_transactions.reason IS 'Reason for stock out (required for inventory_out movements)';
COMMENT ON COLUMN inventory_transactions.destination_warehouse_id IS 'Target warehouse for transfers (required when reason is transfer)';
COMMENT ON COLUMN inventory_transactions.invoice_id IS 'Source invoice for stock in from invoice';
COMMENT ON COLUMN inventory_transactions.invoice_line_item_id IS 'Specific invoice line item for stock in';
COMMENT ON COLUMN inventory_transactions.qmhq_id IS 'Related QMHQ for item route stock out';
