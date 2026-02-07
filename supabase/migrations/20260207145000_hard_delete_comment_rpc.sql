-- ============================================
-- Migration: Create delete_comment RPC function (hard delete)
-- Description: SECURITY DEFINER function to hard-delete comments
-- ============================================

-- Drop the soft delete function
DROP FUNCTION IF EXISTS public.soft_delete_comment(UUID);

-- Create hard delete function
CREATE OR REPLACE FUNCTION public.delete_comment(comment_id UUID)
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
  WHERE id = comment_id;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  -- Check ownership
  IF v_author_id != v_current_user THEN
    RAISE EXCEPTION 'Cannot delete comment you did not author';
  END IF;

  -- Check for replies
  v_has_replies := EXISTS (
    SELECT 1 FROM public.comments WHERE parent_id = comment_id
  );

  IF v_has_replies THEN
    RAISE EXCEPTION 'Cannot delete comment with replies';
  END IF;

  -- Perform hard delete
  DELETE FROM public.comments WHERE id = comment_id;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_comment(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_comment(UUID) IS
  'Hard-delete a comment. User must be the author and comment must have no replies.';
