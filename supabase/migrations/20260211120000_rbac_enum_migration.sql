-- Migration: 20260211120000_rbac_enum_migration
-- Phase: 37 - RBAC Database Migration
-- Description: Migrate user_role enum from 7 values to 3 values using expand-and-contract pattern
--
-- Purpose: The 7-role enum (admin, quartermaster, finance, inventory, proposal, frontline, requester)
-- is being consolidated to 3 roles (admin, qmrl, qmhq) as part of RBAC simplification.
--
-- Role Mapping:
--   admin, quartermaster -> admin (supervisory/full access)
--   finance, inventory, proposal -> qmhq (HQ operations)
--   frontline, requester -> qmrl (field operations)
--
-- Rollback: Restore from pre-migration backup (supabase db dump)
-- This migration is atomic - entire operation wrapped in transaction
--
-- Date: 2026-02-11

BEGIN;

-- ============================================
-- Step 1: Rename old enum type
-- ============================================
ALTER TYPE public.user_role RENAME TO user_role_old;

-- ============================================
-- Step 2: Create new enum with 3 roles
-- ============================================
CREATE TYPE public.user_role AS ENUM ('admin', 'qmrl', 'qmhq');

-- ============================================
-- Step 3: Add temporary column with new type
-- ============================================
ALTER TABLE public.users ADD COLUMN role_new public.user_role;

-- ============================================
-- Step 4: Migrate data with exact mapping
-- ============================================
-- Cast old enum to text for CASE expression, then cast result to new enum
UPDATE public.users
SET role_new = CASE role::text
  WHEN 'admin' THEN 'admin'::public.user_role
  WHEN 'quartermaster' THEN 'admin'::public.user_role
  WHEN 'finance' THEN 'qmhq'::public.user_role
  WHEN 'inventory' THEN 'qmhq'::public.user_role
  WHEN 'proposal' THEN 'qmhq'::public.user_role
  WHEN 'frontline' THEN 'qmrl'::public.user_role
  WHEN 'requester' THEN 'qmrl'::public.user_role
  ELSE NULL
END;

-- ============================================
-- Step 5: Validate no NULL values (data integrity check)
-- ============================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.users
  WHERE role_new IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'RBAC Migration failed: % users have NULL role_new. Data integrity violation.', null_count;
  END IF;
END $$;

-- ============================================
-- Step 6: Swap columns (atomic rename)
-- ============================================
ALTER TABLE public.users DROP COLUMN role;
ALTER TABLE public.users RENAME COLUMN role_new TO role;

-- Restore constraints
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'qmrl';

-- ============================================
-- Step 7: Recreate index
-- ============================================
DROP INDEX IF EXISTS idx_users_role;
CREATE INDEX idx_users_role ON public.users(role);

-- ============================================
-- Step 8: Recreate get_user_role() function
-- ============================================
-- Must DROP first because return type changed from user_role_old to user_role
-- CASCADE drops dependent policies (they'll be recreated in migration 20260211120001)
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
CREATE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Step 9: Recreate handle_new_user() function
-- ============================================
-- Update default role from 'requester' to 'qmrl'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'qmrl'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Step 10: Update comments
-- ============================================
COMMENT ON COLUMN public.users.role IS 'User role for RBAC: admin (full access), qmrl (field operations), qmhq (HQ operations)';
COMMENT ON FUNCTION public.get_user_role IS 'Returns current authenticated user role (admin, qmrl, or qmhq)';

-- ============================================
-- Step 11: Insert audit log marker
-- Note: DROP TYPE user_role_old deferred to migration 20260211120001
-- (old RLS policies still reference it until they're recreated)
-- ============================================
INSERT INTO public.audit_logs (entity_type, entity_id, action, changes_summary, old_values, new_values, changed_at)
VALUES (
  'system',
  gen_random_uuid(),
  'update',
  'RBAC migration: 7 roles consolidated to 3 roles (admin, qmrl, qmhq)',
  jsonb_build_object(
    'roles', jsonb_build_array('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester')
  ),
  jsonb_build_object(
    'roles', jsonb_build_array('admin', 'qmrl', 'qmhq'),
    'mapping', jsonb_build_object(
      'admin', 'admin',
      'quartermaster', 'admin',
      'finance', 'qmhq',
      'inventory', 'qmhq',
      'proposal', 'qmhq',
      'frontline', 'qmrl',
      'requester', 'qmrl'
    )
  ),
  NOW()
);

COMMIT;
