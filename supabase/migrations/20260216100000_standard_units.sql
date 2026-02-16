-- Migration: 20260216100000_standard_units
-- Description: Create standard_units table for entity management and remove global config
-- Date: 2026-02-16

-- ========================================
-- Part 1: Create standard_units table
-- ========================================

-- Standard Units Table (replaces system_config key-value pattern)
CREATE TABLE IF NOT EXISTS public.standard_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Index for display_order (used for sorting in UI)
CREATE INDEX IF NOT EXISTS idx_standard_units_display_order ON public.standard_units(display_order);

-- Updated_at trigger
CREATE TRIGGER trg_standard_units_updated_at
  BEFORE UPDATE ON public.standard_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.standard_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can SELECT, only admin can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS standard_units_select ON public.standard_units;
DROP POLICY IF EXISTS standard_units_insert ON public.standard_units;
DROP POLICY IF EXISTS standard_units_update ON public.standard_units;
DROP POLICY IF EXISTS standard_units_delete ON public.standard_units;

-- Select: All authenticated users can read standard units
CREATE POLICY standard_units_select ON public.standard_units
  FOR SELECT USING (true);

-- Insert: Admin only
CREATE POLICY standard_units_insert ON public.standard_units
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- Update: Admin only
CREATE POLICY standard_units_update ON public.standard_units
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- Delete: Admin only (hard delete is allowed, soft delete not used)
CREATE POLICY standard_units_delete ON public.standard_units
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- Seed data: 9 standard units in sensible order
INSERT INTO public.standard_units (name, display_order) VALUES
  ('pcs', 1),  -- Most common
  ('kg', 2),
  ('g', 3),
  ('L', 4),
  ('mL', 5),
  ('m', 6),
  ('cm', 7),
  ('box', 8),
  ('pack', 9)
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE public.standard_units IS 'Standard units of measurement used throughout the system (entity-managed, not config)';
COMMENT ON COLUMN public.standard_units.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN public.standard_units.name IS 'Unit name (e.g., pcs, kg, L) - unique across system';
COMMENT ON COLUMN public.standard_units.display_order IS 'Sort order for UI display (lower = higher priority)';
COMMENT ON COLUMN public.standard_units.created_at IS 'Timestamp when unit was created';
COMMENT ON COLUMN public.standard_units.updated_at IS 'Timestamp when unit was last updated (auto-updated by trigger)';
COMMENT ON COLUMN public.standard_units.created_by IS 'User who created this unit (NULL if system-created)';
COMMENT ON COLUMN public.standard_units.updated_by IS 'User who last updated this unit';

-- ========================================
-- Part 2: Remove global standard_unit_name from system_config
-- ========================================

-- Delete the global config entry as standard units are now entity-managed
DELETE FROM public.system_config WHERE key = 'standard_unit_name';
