-- Fix: infinite recursion in user_permissions RLS policies
-- Problem: SELECT policy on user_permissions queried user_permissions directly,
--          which triggered the same SELECT policy, causing infinite recursion (42P17).
-- Solution:
--   1. Users can SELECT their own rows (simple column check, no subquery)
--   2. Admin check uses has_permission() which is SECURITY DEFINER (bypasses RLS)
--   3. INSERT/UPDATE/DELETE use has_permission() (SECURITY DEFINER, no recursion)

BEGIN;

-- Drop the recursive policies
DROP POLICY IF EXISTS user_permissions_perm_select ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_perm_insert ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_perm_update ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_perm_delete ON public.user_permissions;

-- SELECT: users read own rows (no subquery), admins read all (via SECURITY DEFINER function)
CREATE POLICY user_permissions_select ON public.user_permissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_permission('admin'::public.permission_resource, 'edit'::public.permission_level)
  );

-- INSERT: admin only (SECURITY DEFINER function bypasses RLS)
CREATE POLICY user_permissions_insert ON public.user_permissions
  FOR INSERT WITH CHECK (
    has_permission('admin'::public.permission_resource, 'edit'::public.permission_level)
  );

-- UPDATE: admin only
CREATE POLICY user_permissions_update ON public.user_permissions
  FOR UPDATE USING (
    has_permission('admin'::public.permission_resource, 'edit'::public.permission_level)
  );

-- DELETE: admin only
CREATE POLICY user_permissions_delete ON public.user_permissions
  FOR DELETE USING (
    has_permission('admin'::public.permission_resource, 'edit'::public.permission_level)
  );

COMMIT;
