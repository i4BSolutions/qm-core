-- Migration: Add code and head_id columns to departments table
-- This allows departments to have a unique code and a department head

-- =============================================================================
-- 1. ADD code COLUMN
-- =============================================================================

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code TEXT;

-- Create unique index for department code
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code) WHERE code IS NOT NULL;

-- =============================================================================
-- 2. ADD head_id COLUMN (reference to users table)
-- =============================================================================

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for head_id
CREATE INDEX IF NOT EXISTS idx_departments_head ON public.departments(head_id);

-- =============================================================================
-- 3. COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.departments.code IS 'Unique department code (e.g., HQ, FIN, LOG)';
COMMENT ON COLUMN public.departments.head_id IS 'Reference to the department head (user)';
