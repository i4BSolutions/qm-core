-- Migration: 003_status_config
-- Description: Create status configuration table (Notion-style status system)
-- Date: 2025-01-21

-- Create entity type enum
DO $$ BEGIN
  CREATE TYPE public.entity_type AS ENUM ('qmrl', 'qmhq');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create status group enum
DO $$ BEGIN
  CREATE TYPE public.status_group AS ENUM ('to_do', 'in_progress', 'done');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Status configuration table
CREATE TABLE IF NOT EXISTS public.status_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL,
  status_group public.status_group NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Hex color (e.g., '#3B82F6')
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT status_config_entity_name_unique UNIQUE (entity_type, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_status_config_entity ON public.status_config(entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_status_config_group ON public.status_config(entity_type, status_group);
CREATE INDEX IF NOT EXISTS idx_status_config_default ON public.status_config(entity_type, is_default) WHERE is_default = true;

-- Updated_at trigger
CREATE TRIGGER trg_status_config_updated_at
  BEFORE UPDATE ON public.status_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default status per entity_type and status_group
CREATE OR REPLACE FUNCTION public.ensure_single_default_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.status_config
    SET is_default = false
    WHERE entity_type = NEW.entity_type
      AND status_group = NEW.status_group
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_config_single_default
  BEFORE INSERT OR UPDATE ON public.status_config
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.ensure_single_default_status();

-- Seed default QMRL statuses
INSERT INTO public.status_config (entity_type, status_group, name, description, color, display_order, is_default) VALUES
  -- QMRL To Do
  ('qmrl', 'to_do', 'Draft', 'Initial draft state', '#9CA3AF', 1, true),
  ('qmrl', 'to_do', 'Pending Review', 'Awaiting review', '#F59E0B', 2, false),
  -- QMRL In Progress
  ('qmrl', 'in_progress', 'Under Processing', 'Being processed', '#3B82F6', 3, false),
  ('qmrl', 'in_progress', 'Awaiting Approval', 'Pending final approval', '#8B5CF6', 4, false),
  -- QMRL Done
  ('qmrl', 'done', 'Completed', 'Successfully completed', '#10B981', 5, false),
  ('qmrl', 'done', 'Rejected', 'Request rejected', '#EF4444', 6, false)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Seed default QMHQ statuses
INSERT INTO public.status_config (entity_type, status_group, name, description, color, display_order, is_default) VALUES
  -- QMHQ To Do
  ('qmhq', 'to_do', 'Not Started', 'Not yet started', '#9CA3AF', 1, true),
  ('qmhq', 'to_do', 'Pending', 'Pending action', '#F59E0B', 2, false),
  -- QMHQ In Progress
  ('qmhq', 'in_progress', 'Processing', 'Being processed', '#3B82F6', 3, false),
  ('qmhq', 'in_progress', 'Awaiting Delivery', 'Waiting for delivery', '#8B5CF6', 4, false),
  -- QMHQ Done
  ('qmhq', 'done', 'Completed', 'Successfully completed', '#10B981', 5, false),
  ('qmhq', 'done', 'Cancelled', 'Cancelled', '#EF4444', 6, false)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Function to get default status ID for an entity type
CREATE OR REPLACE FUNCTION public.get_default_status_id(p_entity_type public.entity_type)
RETURNS UUID AS $$
  SELECT id FROM public.status_config
  WHERE entity_type = p_entity_type
    AND is_default = true
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Comments
COMMENT ON TABLE public.status_config IS 'Notion-style status configuration for QMRL and QMHQ';
COMMENT ON COLUMN public.status_config.status_group IS 'Visual grouping: to_do, in_progress, done';
COMMENT ON COLUMN public.status_config.color IS 'Hex color for UI display';
COMMENT ON COLUMN public.status_config.is_default IS 'Default status for new entities of this type';
