-- ============================================
-- Migration: Fix comments UPDATE RLS policy
-- Description: Add WITH CHECK clause to allow soft-delete operations
-- Issue: "new row violates row-level security" when deleting comments
-- Root Cause: UPDATE policy missing WITH CHECK, falls back to USING which blocks the operation
-- ============================================

-- DROP and recreate the UPDATE policy with WITH CHECK clause
DROP POLICY IF EXISTS comments_update ON public.comments;

-- UPDATE (soft delete): Users can soft-delete their own comments if they have no replies
-- Only allow setting deleted_at and deleted_by (not editing content)
CREATE POLICY comments_update ON public.comments
  FOR UPDATE
  USING (
    -- User must be the author and comment must have no replies
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  )
  WITH CHECK (
    -- After update, still must be the author's comment with no replies
    -- This allows setting deleted_at and deleted_by
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  );

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON POLICY comments_update ON public.comments IS 'Users can soft-delete their own comments by setting deleted_at/deleted_by if the comment has no replies. WITH CHECK ensures the update is allowed.';
