-- Migration: 009_qmrl.sql
-- Description: Create QMRL (Request Letter) table
-- Dependencies: departments, users, status_config, categories, contact_persons

-- Create QMRL table
CREATE TABLE qmrl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,

  -- Status (single status - Notion style)
  status_id UUID REFERENCES status_config(id),

  -- Category (classification only - NOT route selector)
  category_id UUID REFERENCES categories(id),

  department_id UUID REFERENCES departments(id) NOT NULL,
  contact_person_id UUID REFERENCES contact_persons(id),

  -- Assignment
  assigned_to UUID REFERENCES users(id),
  requester_id UUID REFERENCES users(id) NOT NULL,

  request_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  notes TEXT,

  -- Soft delete
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_qmrl_status ON qmrl(status_id);
CREATE INDEX idx_qmrl_category ON qmrl(category_id);
CREATE INDEX idx_qmrl_assigned ON qmrl(assigned_to);
CREATE INDEX idx_qmrl_requester ON qmrl(requester_id);
CREATE INDEX idx_qmrl_department ON qmrl(department_id);
CREATE INDEX idx_qmrl_request_date ON qmrl(request_date);
CREATE INDEX idx_qmrl_is_active ON qmrl(is_active);

-- Function to generate QMRL request_id (QMRL-YYYY-NNNNN format)
CREATE OR REPLACE FUNCTION generate_qmrl_request_id()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_request_id TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(request_id FROM 'QMRL-' || current_year || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_number
  FROM qmrl
  WHERE request_id LIKE 'QMRL-' || current_year || '-%';

  -- Format: QMRL-YYYY-NNNNN
  new_request_id := 'QMRL-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');

  NEW.request_id := new_request_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request_id on insert
CREATE TRIGGER trg_generate_qmrl_request_id
  BEFORE INSERT ON qmrl
  FOR EACH ROW
  WHEN (NEW.request_id IS NULL OR NEW.request_id = '')
  EXECUTE FUNCTION generate_qmrl_request_id();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qmrl_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_qmrl_updated_at
  BEFORE UPDATE ON qmrl
  FOR EACH ROW
  EXECUTE FUNCTION update_qmrl_updated_at();

-- Add comments for documentation
COMMENT ON TABLE qmrl IS 'QM Request Letters - main request tracking entity';
COMMENT ON COLUMN qmrl.request_id IS 'Human-readable ID in format QMRL-YYYY-NNNNN';
COMMENT ON COLUMN qmrl.status_id IS 'Current status from status_config table';
COMMENT ON COLUMN qmrl.category_id IS 'Category for classification (not route selection)';
COMMENT ON COLUMN qmrl.assigned_to IS 'Currently assigned user responsible for this request';
COMMENT ON COLUMN qmrl.requester_id IS 'User who created/requested this QMRL';
COMMENT ON COLUMN qmrl.priority IS 'Priority level: low, medium, high, critical';
