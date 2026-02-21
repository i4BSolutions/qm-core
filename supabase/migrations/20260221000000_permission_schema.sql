-- Migration: 20260221000000_permission_schema
-- Phase: 59 - Permission Schema & Migration
-- Description: Create user_permissions table with resource/level enums, helper functions,
--              RLS policies, and update handle_new_user() to seed default permissions.
--
-- This is the foundation for v1.13 Permission Matrix.
-- Phase 60 will rewrite RLS policies to use has_permission().
-- Phase 61 will build the Permission Management UI.
--
-- IMPORTANT: The users.role column is NOT dropped here.
-- 100+ existing RLS policies reference get_user_role(). Phase 60 will rewrite those
-- policies to use has_permission() and then Phase 60 will drop the role column.
--
-- Date: 2026-02-21

BEGIN;

-- ============================================
-- Step 1: Create resource identifier enum
-- ============================================
CREATE TYPE public.permission_resource AS ENUM (
  'system_dashboard',
  'qmrl',
  'qmhq',
  'money_transactions',
  'inv_transactions',
  'po',
  'invoice',
  'stock_in',
  'sor',
  'sor_l1',
  'sor_l2',
  'sor_l3',
  'warehouse',
  'inventory_dashboard',
  'item',
  'admin'
);

COMMENT ON TYPE public.permission_resource IS
  'The 16 protected resources in the QM permission matrix. '
  'Enforced as an enum to prevent free-text resource names.';

-- ============================================
-- Step 2: Create access level enum
-- ============================================
CREATE TYPE public.permission_level AS ENUM ('edit', 'view', 'block');

COMMENT ON TYPE public.permission_level IS
  'Access level for a resource: '
  'edit = full CRUD, view = read-only, block = no access (hidden).';

-- ============================================
-- Step 3: Create user_permissions table
-- ============================================
CREATE TABLE public.user_permissions (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID             NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resource   public.permission_resource NOT NULL,
  level      public.permission_level    NOT NULL DEFAULT 'block',
  created_at TIMESTAMPTZ      DEFAULT NOW(),
  updated_at TIMESTAMPTZ      DEFAULT NOW(),

  -- One row per user per resource
  UNIQUE (user_id, resource)
);

COMMENT ON TABLE public.user_permissions IS
  'Per-user per-resource permission matrix. '
  'Every user must have exactly 16 rows (one per permission_resource enum value). '
  'Missing row = block (fail closed). Phase 59 seed, Phase 60 enforces via RLS.';

COMMENT ON COLUMN public.user_permissions.user_id   IS 'References public.users(id). Cascades on user deletion.';
COMMENT ON COLUMN public.user_permissions.resource  IS 'The protected resource (enum, 16 values).';
COMMENT ON COLUMN public.user_permissions.level     IS 'Access level: edit, view, or block.';

-- ============================================
-- Step 4: Add indexes
-- ============================================
CREATE INDEX idx_user_permissions_user
  ON public.user_permissions(user_id);

CREATE INDEX idx_user_permissions_resource
  ON public.user_permissions(resource);

-- Covering index for the most common lookup pattern: user + resource -> level
CREATE INDEX idx_user_permissions_user_resource
  ON public.user_permissions(user_id, resource);

-- ============================================
-- Step 5: Add updated_at trigger
-- ============================================
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Step 6: Helper function — check_user_permission()
-- Returns the permission level for a given user + resource.
-- Returns 'block' when no row exists (fail closed).
-- Used by server-side code and admin queries.
-- ============================================
CREATE OR REPLACE FUNCTION public.check_user_permission(
  p_user_id UUID,
  p_resource public.permission_resource
)
RETURNS public.permission_level AS $$
DECLARE
  result public.permission_level;
BEGIN
  SELECT level INTO result
  FROM public.user_permissions
  WHERE user_id = p_user_id AND resource = p_resource;

  -- Missing row = block (fail closed)
  RETURN COALESCE(result, 'block'::public.permission_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.check_user_permission IS
  'Returns permission level for a given user + resource. '
  'Returns ''block'' when no row exists (fail closed). '
  'Use has_permission() in RLS policies (reads auth.uid() automatically).';

-- ============================================
-- Step 7: Helper function — has_permission()
-- Checks if the current authenticated user (auth.uid()) meets
-- the required permission level for a resource.
-- Used by RLS policies in Phase 60.
--
-- Level hierarchy: edit > view > block
--   has_permission(resource, 'edit')  → true only if user has 'edit'
--   has_permission(resource, 'view')  → true if user has 'view' OR 'edit'
--   has_permission(resource, 'block') → true if user IS blocked (has 'block' or no row)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_permission(
  p_resource public.permission_resource,
  p_level    public.permission_level
)
RETURNS BOOLEAN AS $$
DECLARE
  user_level public.permission_level;
BEGIN
  SELECT level INTO user_level
  FROM public.user_permissions
  WHERE user_id = auth.uid() AND resource = p_resource;

  -- Missing row = block (fail closed)
  IF user_level IS NULL THEN
    -- Only return true when caller is asking "is this user blocked?"
    RETURN p_level = 'block';
  END IF;

  IF p_level = 'edit' THEN
    -- Caller needs edit: user must have 'edit'
    RETURN user_level = 'edit';
  ELSIF p_level = 'view' THEN
    -- Caller needs view: user satisfies with 'view' or 'edit'
    RETURN user_level IN ('view', 'edit');
  ELSIF p_level = 'block' THEN
    -- Caller is checking if user is blocked
    RETURN user_level = 'block';
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.has_permission IS
  'RLS helper: checks if the current auth.uid() user meets the required '
  'permission level for a resource. Level hierarchy: edit > view > block. '
  'Returns false when no row exists (fail closed). Phase 60 will use this in all RLS policies.';

-- ============================================
-- Step 8: Utility function — create_default_permissions()
-- Inserts 16 Block rows for a given user_id.
-- Safe to call multiple times (ON CONFLICT DO NOTHING).
-- Called by updated handle_new_user() trigger and admin tooling.
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_permissions(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, resource, level)
  SELECT
    p_user_id,
    r,
    'block'::public.permission_level
  FROM unnest(enum_range(NULL::public.permission_resource)) AS r
  ON CONFLICT (user_id, resource) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_default_permissions IS
  'Inserts all 16 permission resources with ''block'' level for a given user. '
  'Idempotent (ON CONFLICT DO NOTHING). '
  'Called by handle_new_user() for every new signup.';

-- ============================================
-- Step 9: Update handle_new_user() trigger function
-- Adds create_default_permissions() call so every new signup
-- immediately gets 16 Block permission rows.
-- The users.role column is still set (for backward-compat with Phase 60 RLS rewrite).
-- ============================================
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

  -- Seed all 16 resources as Block — admin must explicitly grant permissions
  PERFORM public.create_default_permissions(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Trigger function: creates public.users profile and seeds 16 Block permission rows '
  'for every new auth.users signup. Role defaults to ''qmrl'' for backward compatibility '
  'until Phase 60 drops the role column.';

-- ============================================
-- Step 10: RLS policies for user_permissions table
-- Admins (via get_user_role()) have full access.
-- Non-admins can only read their own rows.
-- No self-service insert/update/delete for non-admins.
-- Note: After Phase 60 rewrites all RLS to use has_permission(), the admin
-- check below can be updated to: has_permission('admin', 'edit').
-- ============================================
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all rows (read, write, delete)
CREATE POLICY "admin_full_access_permissions"
  ON public.user_permissions
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Non-admin: read own rows only
CREATE POLICY "users_read_own_permissions"
  ON public.user_permissions
  FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
