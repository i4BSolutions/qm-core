-- Migration: 008_warehouses.sql
-- Description: Create warehouses table for inventory storage locations

-- Warehouses table
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  description TEXT,
  capacity_notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_warehouses_active ON warehouses(is_active) WHERE is_active = true;
CREATE INDEX idx_warehouses_name ON warehouses(name);
CREATE INDEX idx_warehouses_location ON warehouses(location);

-- Updated at trigger
CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default warehouses
INSERT INTO warehouses (name, location, description) VALUES
  ('Main Warehouse', 'Building A, Floor 1', 'Primary storage facility'),
  ('Sub Warehouse', 'Building B, Floor 2', 'Secondary storage facility');

COMMENT ON TABLE warehouses IS 'Storage locations for inventory items';
