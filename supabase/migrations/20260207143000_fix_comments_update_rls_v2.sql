-- ============================================
-- Migration: Fix comments UPDATE RLS policy v2
-- Description: Simplify WITH CHECK to just verify author ownership
-- Issue: WITH CHECK calling helper function may cause issues
-- ============================================

-- DROP and recreate the UPDATE policy with simpler WITH CHECK
DROP POLICY IF EXISTS comments_update ON public.comments;

-- UPDATE (soft delete): Users can soft-delete their own comments if they have no replies
-- USING: Controls what rows can be selected for update
-- WITH CHECK: Controls what the final row values can be (just needs author check)
CREATE POLICY comments_update ON public.comments
  FOR UPDATE
  USING (
    -- Can update if: own comment AND no replies
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  )
  WITH CHECK (
    -- After update, just verify still owns the comment
    -- Don't re-check has_replies since it uses OLD.id not NEW.id
    author_id = auth.uid()
  );
