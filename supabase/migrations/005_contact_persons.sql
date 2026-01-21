-- Migration: 005_contact_persons.sql
-- Description: Create contact_persons table for managing department contacts

-- Contact Persons table
CREATE TABLE contact_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_contact_persons_department ON contact_persons(department_id);
CREATE INDEX idx_contact_persons_active ON contact_persons(is_active) WHERE is_active = true;
CREATE INDEX idx_contact_persons_name ON contact_persons(name);

-- Updated at trigger
CREATE TRIGGER update_contact_persons_updated_at
  BEFORE UPDATE ON contact_persons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE contact_persons IS 'Contact persons associated with departments for QMRL/QMHQ';
