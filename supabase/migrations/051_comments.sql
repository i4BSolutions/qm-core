-- ============================================
-- Migration: 051_comments.sql
-- Description: Create comments table for threaded comments on QMRL, QMHQ, PO, and Invoice entities
-- Phase: 23-comments-system
-- ============================================
-- This table stores threaded comments on various entities.
-- Uses polymorphic relationship via entity_type + entity_id columns.
-- Enforces single-level threading (comments can have replies, but replies cannot have replies).
-- Supports soft delete with deleted_at column.
-- ============================================

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity relationship
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq', 'po', 'invoice')),
  entity_id UUID NOT NULL, -- References qmrl.id, qmhq.id, purchase_orders.id, or invoices.id (no FK constraint - polymorphic)

  -- Threading
  parent_id UUID REFERENCES public.comments(id) ON DELETE RESTRICT, -- For single-level threading

  -- Content
  content TEXT NOT NULL CHECK (char_length(content) > 0),

  -- Ownership
  author_id UUID NOT NULL REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ, -- NULL = active, set = soft deleted
  deleted_by UUID REFERENCES public.users(id),

  -- Standard audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Index for entity lookups (most common query pattern)
-- Only index non-deleted comments for performance
CREATE INDEX idx_comments_entity
  ON public.comments(entity_type, entity_id)
  WHERE deleted_at IS NULL;

-- Index for parent lookups (for fetching replies)
CREATE INDEX idx_comments_parent
  ON public.comments(parent_id)
  WHERE deleted_at IS NULL;

-- Index for author lookups (for user's comment history)
CREATE INDEX idx_comments_author
  ON public.comments(author_id);

-- ============================================
-- Constraint: Single-Level Threading
-- ============================================

-- Trigger function to enforce single-level threading
CREATE OR REPLACE FUNCTION public.enforce_single_level_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if parent is itself a reply
    IF EXISTS (SELECT 1 FROM public.comments WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Replies cannot have nested replies (single-level threading only)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single-level threading
DROP TRIGGER IF EXISTS comments_enforce_single_level ON public.comments;
CREATE TRIGGER comments_enforce_single_level
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_level_reply();

-- ============================================
-- Helper Functions
-- ============================================

-- Helper function to check if a comment has replies
CREATE OR REPLACE FUNCTION public.comment_has_replies(comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.comments
    WHERE parent_id = comment_id AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS comments_update_timestamp ON public.comments;
CREATE TRIGGER comments_update_timestamp
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comments_updated_at();

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- Comment access mirrors parent entity access
-- ============================================

-- DROP existing policies if any (for idempotency)
DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;

-- SELECT: Users can view comments if they can view the parent entity
-- Admin, Quartermaster, Finance, Inventory, Proposal, Frontline: all non-deleted comments
-- Requester: only comments on entities they own
CREATE POLICY comments_select ON public.comments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Privileged roles can see all comments
      public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
      OR (
        -- Requester can see comments on their own QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmrl'
        AND public.owns_qmrl(entity_id)
      )
      OR (
        -- Requester can see comments on QMHQ linked to their QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmhq'
        AND public.owns_qmhq(entity_id)
      )
      -- Requesters cannot see PO or Invoice comments (per existing RLS - they don't have access to those entities)
    )
  );

-- INSERT: Users who can view the entity can comment on it
-- Admin, Quartermaster: can comment on any entity
-- Finance, Inventory: can comment on any entity (they need to discuss PO/Invoice)
-- Proposal, Frontline: can comment on qmrl and qmhq
-- Requester: can only comment on their own QMRL
CREATE POLICY comments_insert ON public.comments
  FOR INSERT WITH CHECK (
    -- Admin and Quartermaster can comment on any entity
    public.get_user_role() IN ('admin', 'quartermaster')
    OR (
      -- Finance and Inventory can comment on any entity
      public.get_user_role() IN ('finance', 'inventory')
    )
    OR (
      -- Proposal and Frontline can comment on qmrl and qmhq
      public.get_user_role() IN ('proposal', 'frontline')
      AND entity_type IN ('qmrl', 'qmhq')
    )
    OR (
      -- Requester can only comment on their own QMRL
      public.get_user_role() = 'requester'
      AND entity_type = 'qmrl'
      AND public.owns_qmrl(entity_id)
    )
  );

-- UPDATE (soft delete): Users can soft-delete their own comments if they have no replies
-- Only allow setting deleted_at and deleted_by (not editing content)
CREATE POLICY comments_update ON public.comments
  FOR UPDATE USING (
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  );

-- DELETE (hard delete): Admin only - used for cleanup
-- Normal users should soft-delete via UPDATE
CREATE POLICY comments_delete ON public.comments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- Grant execute permissions on helper functions
-- ============================================
GRANT EXECUTE ON FUNCTION public.comment_has_replies(UUID) TO authenticated;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.comments IS 'Threaded comments on QMRL, QMHQ, PO, and Invoice entities. Single-level threading enforced.';
COMMENT ON COLUMN public.comments.entity_type IS 'Type of parent entity: qmrl, qmhq, po, or invoice';
COMMENT ON COLUMN public.comments.entity_id IS 'UUID of parent entity (polymorphic, no FK)';
COMMENT ON COLUMN public.comments.parent_id IS 'Parent comment ID for threading. NULL = top-level comment';
COMMENT ON COLUMN public.comments.content IS 'Comment text content (required, cannot be empty)';
COMMENT ON COLUMN public.comments.deleted_at IS 'Soft delete timestamp. NULL = active. Cannot delete if has replies.';
