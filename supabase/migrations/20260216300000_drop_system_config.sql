-- Migration: 20260216300000_drop_system_config
-- Description: Drop system_config table - standard unit names now come from per-item standard_units table
-- Date: 2026-02-16

-- Drop RLS policies
DROP POLICY IF EXISTS system_config_select ON public.system_config;
DROP POLICY IF EXISTS system_config_insert ON public.system_config;
DROP POLICY IF EXISTS system_config_update ON public.system_config;
DROP POLICY IF EXISTS system_config_delete ON public.system_config;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_system_config_updated_at ON public.system_config;

-- Drop index
DROP INDEX IF EXISTS public.idx_system_config_key;

-- Drop table
DROP TABLE IF EXISTS public.system_config;

-- Comments
COMMENT ON COLUMN public.system_config.key IS NULL;
COMMENT ON COLUMN public.system_config.value IS NULL;
COMMENT ON COLUMN public.system_config.description IS NULL;
COMMENT ON TABLE public.system_config IS NULL;
