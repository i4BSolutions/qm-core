-- Migration: 035_qmhq_items.sql
-- Description: Junction table for multi-item QMHQ support

-- Create qmhq_items junction table
CREATE TABLE IF NOT EXISTS qmhq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent QMHQ reference
  qmhq_id UUID NOT NULL REFERENCES qmhq(id) ON DELETE CASCADE,

  -- Item reference
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

  -- Quantity requested
  quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),

  -- Source warehouse for stock-out
  warehouse_id UUID REFERENCES warehouses(id),

  -- Prevent duplicate items in same QMHQ
  UNIQUE(qmhq_id, item_id),

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_qmhq_items_qmhq_id ON qmhq_items(qmhq_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_items_item_id ON qmhq_items(item_id);
CREATE INDEX IF NOT EXISTS idx_qmhq_items_warehouse_id ON qmhq_items(warehouse_id);

-- RLS Policies (inherit from qmhq permissions)
ALTER TABLE qmhq_items ENABLE ROW LEVEL SECURITY;

-- SELECT: Same users who can view QMHQ
CREATE POLICY qmhq_items_select ON qmhq_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qmhq
      WHERE qmhq.id = qmhq_items.qmhq_id
    )
  );

-- INSERT: Same users who can create QMHQ
CREATE POLICY qmhq_items_insert ON qmhq_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM qmhq
      WHERE qmhq.id = qmhq_items.qmhq_id
    )
  );

-- UPDATE: Same users who can update QMHQ
CREATE POLICY qmhq_items_update ON qmhq_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM qmhq
      WHERE qmhq.id = qmhq_items.qmhq_id
    )
  );

-- DELETE: Same users who can update QMHQ
CREATE POLICY qmhq_items_delete ON qmhq_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM qmhq
      WHERE qmhq.id = qmhq_items.qmhq_id
    )
  );

-- Comments
COMMENT ON TABLE qmhq_items IS 'Junction table for multi-item QMHQ requests';
COMMENT ON COLUMN qmhq_items.qmhq_id IS 'Parent QMHQ record';
COMMENT ON COLUMN qmhq_items.item_id IS 'Requested item';
COMMENT ON COLUMN qmhq_items.quantity IS 'Quantity requested';
COMMENT ON COLUMN qmhq_items.warehouse_id IS 'Source warehouse for stock-out (optional, can differ per item)';
