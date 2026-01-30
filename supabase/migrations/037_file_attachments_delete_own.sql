-- ============================================
-- Migration: 037_file_attachments_delete_own.sql
-- Description: Allow users to soft-delete their own uploaded files
-- ============================================
-- Previous policy only allowed admin/quartermaster to delete.
-- This update allows:
-- 1. Admin/Quartermaster can delete any file
-- 2. Users can delete files they uploaded themselves
-- ============================================

-- Drop and recreate the UPDATE policy
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;

CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (
    -- Admin/Quartermaster can update any file
    public.get_user_role() IN ('admin', 'quartermaster')
    OR
    -- Users can update (soft-delete) files they uploaded
    uploaded_by = auth.uid()
  )
  WITH CHECK (
    -- Same conditions for the new row
    public.get_user_role() IN ('admin', 'quartermaster')
    OR
    uploaded_by = auth.uid()
  );

COMMENT ON POLICY file_attachments_update ON public.file_attachments IS
  'Admin/Quartermaster can soft-delete any file. Users can soft-delete their own uploads.';
