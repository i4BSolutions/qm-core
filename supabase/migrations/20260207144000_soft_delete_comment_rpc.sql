-- ============================================
-- Migration: Create soft_delete_comment RPC function
-- Description: SECURITY DEFINER function to soft-delete comments with proper auth checks
-- Reason: RLS UPDATE policy has issues with WITH CHECK clause
-- ============================================

CREATE OR REPLACE FUNCTION public.soft_delete_comment(comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_has_replies BOOLEAN;
  v_current_user UUID;
BEGIN
  -- Get current user
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get comment details
  SELECT author_id INTO v_author_id
  FROM public.comments
  WHERE id = comment_id AND deleted_at IS NULL;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found or already deleted';
  END IF;

  -- Check ownership
  IF v_author_id != v_current_user THEN
    RAISE EXCEPTION 'Cannot delete comment you did not author';
  END IF;

  -- Check for replies
  v_has_replies := public.comment_has_replies(comment_id);

  IF v_has_replies THEN
    RAISE EXCEPTION 'Cannot delete comment with replies';
  END IF;

  -- Perform soft delete
  UPDATE public.comments
  SET
    deleted_at = NOW(),
    deleted_by = v_current_user
  WHERE id = comment_id;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(UUID) TO authenticated;

COMMENT ON FUNCTION public.soft_delete_comment(UUID) IS
  'Soft-delete a comment. User must be the author and comment must have no replies.';
