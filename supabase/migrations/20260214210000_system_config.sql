-- Migration: 20260214210000_system_config
-- Description: Create system_config table for global configuration settings
-- Date: 2026-02-14

-- System configuration table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,

  -- Audit fields
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for key lookup (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);

-- Updated_at trigger
CREATE TRIGGER trg_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can SELECT, only admin can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS system_config_select ON public.system_config;
DROP POLICY IF EXISTS system_config_insert ON public.system_config;
DROP POLICY IF EXISTS system_config_update ON public.system_config;
DROP POLICY IF EXISTS system_config_delete ON public.system_config;

-- Select: All authenticated users can read configuration
CREATE POLICY system_config_select ON public.system_config
  FOR SELECT USING (true);

-- Insert: Admin only
CREATE POLICY system_config_insert ON public.system_config
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- Update: Admin only
CREATE POLICY system_config_update ON public.system_config
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- Delete: Admin only
CREATE POLICY system_config_delete ON public.system_config
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- Seed default configuration
INSERT INTO public.system_config (key, value, description) VALUES
  ('standard_unit_name', 'Standard Units', 'Display name for the system-wide standard unit (shown alongside quantities)')
ON CONFLICT (key) DO NOTHING;

-- Comments
COMMENT ON TABLE public.system_config IS 'System-wide configuration settings (key-value store)';
COMMENT ON COLUMN public.system_config.key IS 'Configuration key (unique identifier)';
COMMENT ON COLUMN public.system_config.value IS 'Configuration value (stored as text)';
COMMENT ON COLUMN public.system_config.description IS 'Human-readable description of this setting';
