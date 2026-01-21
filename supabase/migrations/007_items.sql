-- Migration: 007_items.sql
-- Description: Create items table with WAC (Weighted Average Cost) valuation support

-- Item category enum
CREATE TYPE item_category AS ENUM ('equipment', 'consumable', 'uniform', 'other');

-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category item_category DEFAULT 'other',
  sku TEXT UNIQUE,
  default_unit TEXT DEFAULT 'pcs',

  -- WAC Valuation (auto-updated by triggers)
  wac_amount DECIMAL(15,2) DEFAULT 0.00,
  wac_currency TEXT DEFAULT 'MMK',
  wac_exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  wac_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN wac_exchange_rate > 0 THEN ROUND(wac_amount / wac_exchange_rate, 2) ELSE 0 END
  ) STORED,

  is_active BOOLEAN DEFAULT true,
  photo_url TEXT,

  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_category ON items(category);

-- Updated at trigger
CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate SKU if not provided
CREATE OR REPLACE FUNCTION generate_item_sku()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    -- Get prefix based on category
    prefix := CASE NEW.category
      WHEN 'equipment' THEN 'EQ'
      WHEN 'consumable' THEN 'CS'
      WHEN 'uniform' THEN 'UN'
      ELSE 'IT'
    END;

    -- Get next number
    SELECT COALESCE(MAX(
      CASE
        WHEN sku ~ ('^' || prefix || '-[0-9]+$')
        THEN CAST(SUBSTRING(sku FROM (prefix || '-([0-9]+)$')) AS INT)
        ELSE 0
      END
    ), 0) + 1 INTO next_num
    FROM items;

    NEW.sku := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_item_sku_trigger
  BEFORE INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION generate_item_sku();

COMMENT ON TABLE items IS 'Inventory items with WAC valuation';
COMMENT ON COLUMN items.wac_amount IS 'Weighted Average Cost in local currency';
COMMENT ON COLUMN items.wac_amount_eusd IS 'WAC in EUSD (auto-calculated)';
