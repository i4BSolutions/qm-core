-- Migration: 004_categories
-- Description: Create categories table for QMRL and QMHQ classification
-- Date: 2025-01-21

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Hex color for UI display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT categories_entity_name_unique UNIQUE (entity_type, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_entity ON public.categories(entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(entity_type, display_order);

-- Updated_at trigger
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default QMRL categories
INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('qmrl', 'Operations', 'Operational requests', '#3B82F6', 1),
  ('qmrl', 'Logistics', 'Logistics and supply chain', '#10B981', 2),
  ('qmrl', 'Equipment', 'Equipment requests', '#F59E0B', 3),
  ('qmrl', 'Personnel', 'Personnel related requests', '#8B5CF6', 4),
  ('qmrl', 'Emergency', 'Emergency requests', '#EF4444', 5)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Seed default QMHQ categories
INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('qmhq', 'Purchase', 'Purchase items', '#3B82F6', 1),
  ('qmhq', 'Service', 'Service requests', '#10B981', 2),
  ('qmhq', 'Travel', 'Travel expenses', '#F59E0B', 3),
  ('qmhq', 'Maintenance', 'Maintenance and repairs', '#8B5CF6', 4),
  ('qmhq', 'Other', 'Other categories', '#6B7280', 5)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Function to get active categories for an entity type
CREATE OR REPLACE FUNCTION public.get_categories(p_entity_type public.entity_type)
RETURNS SETOF public.categories AS $$
  SELECT * FROM public.categories
  WHERE entity_type = p_entity_type
    AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE sql STABLE;

-- Comments
COMMENT ON TABLE public.categories IS 'Categories for classifying QMRL and QMHQ entries';
COMMENT ON COLUMN public.categories.entity_type IS 'Whether this category is for qmrl or qmhq';
COMMENT ON COLUMN public.categories.color IS 'Hex color for visual distinction in UI';
