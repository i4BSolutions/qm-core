-- ============================================
-- Migration: 20260219110000_users_display_info_read.sql
-- Description: Allow all authenticated users to read other users' display info
--
-- Problem:
--   users_select_own (id = auth.uid()) means qmrl/qmhq roles can only read
--   their own user row. When the comments section joins users for the author
--   field, comments authored by OTHER users return null for the author join.
--   This causes crashes in comment-card.tsx when accessing author.full_name.
--
-- Fix:
--   Add a new SELECT policy allowing all authenticated roles to read all user
--   rows. This is required for collaboration features (comments, assignment
--   display, etc.) to work correctly for all roles.
--
--   This is safe because:
--   1. The users table does not contain highly sensitive fields beyond email
--   2. In a collaborative workplace tool, seeing colleague names is expected
--   3. The existing INSERT/UPDATE/DELETE policies remain unchanged (admin-only
--      writes, own-row updates)
-- ============================================

-- Drop the existing admin-only select policy and replace with all-authenticated
DROP POLICY IF EXISTS users_select_admin ON public.users;

-- New policy: all authenticated users can read all user rows
-- (replaces admin-only policy; users_select_own remains for explicit own-row access)
CREATE POLICY users_select_all_authenticated ON public.users
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Summary of changes:
--   - users_select_admin: DROPPED (admin-only read-all)
--   - users_select_all_authenticated: ADDED (all authenticated users can read all rows)
--   - users_select_own: UNCHANGED (explicit own-row policy, now redundant but kept for clarity)
--   - All write policies (INSERT/UPDATE/DELETE) unchanged
-- ============================================
