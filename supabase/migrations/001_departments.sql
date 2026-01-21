-- Migration: 001_departments
-- Description: Create departments table with hierarchical structure
-- Date: 2025-01-21

-- Departments table (must be created before users due to FK)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields (created_by/updated_by will be added after users table exists)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT departments_name_unique UNIQUE (name)
);

-- Index for parent lookup (hierarchical queries)
CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_id);

-- Index for active departments
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active) WHERE is_active = true;

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default departments
INSERT INTO public.departments (name, description) VALUES
  ('Headquarters', 'Main headquarters'),
  ('Field Operations', 'Field operations department'),
  ('Finance', 'Finance and accounting'),
  ('Logistics', 'Supply chain and logistics'),
  ('Administration', 'Administrative department')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE public.departments IS 'Organizational departments with hierarchical support';
COMMENT ON COLUMN public.departments.parent_id IS 'Self-referential FK for department hierarchy';
