-- ============================================
-- Migration: 036_fix_file_attachments_rls.sql
-- Description: Fix file_attachments UPDATE policy missing WITH CHECK clause
-- ============================================
-- The UPDATE policy was missing WITH CHECK, causing soft delete to fail
-- with "new row violates row-level security policy" error.
-- PostgreSQL RLS requires both USING (for existing row) and WITH CHECK
-- (for new row after update) to pass for UPDATE operations.
-- ============================================

-- Drop and recreate the UPDATE policy with proper WITH CHECK clause
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;

CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

-- Add comment
COMMENT ON POLICY file_attachments_update ON public.file_attachments IS
  'Admin and Quartermaster can soft-delete files (update deleted_at/deleted_by)';
