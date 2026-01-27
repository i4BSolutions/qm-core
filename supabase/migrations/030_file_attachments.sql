-- ============================================
-- Migration: 030_file_attachments.sql
-- Description: Create file_attachments metadata table for QMRL/QMHQ file storage
-- Phase: 02-file-storage-foundation
-- ============================================
-- This table stores metadata for files attached to QMRL and QMHQ entities.
-- Actual file content is stored in Supabase Storage bucket 'attachments'.
-- Uses polymorphic relationship via entity_type + entity_id columns.
-- Supports soft delete with 30-day grace period before permanent purge.
-- ============================================

-- Create file_attachments table
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity relationship
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  entity_id UUID NOT NULL, -- References qmrl.id or qmhq.id (no FK constraint - polymorphic)

  -- File metadata
  filename TEXT NOT NULL, -- Original filename preserved for display
  storage_path TEXT NOT NULL UNIQUE, -- Path in storage bucket (e.g., 'qmrl/{id}/file_123.pdf')
  file_size BIGINT NOT NULL, -- Size in bytes
  mime_type TEXT NOT NULL, -- MIME type (e.g., 'application/pdf')

  -- Ownership/audit
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ, -- NULL = active, set = soft deleted
  deleted_by UUID REFERENCES public.users(id),

  -- Standard audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for entity lookups (most common query pattern)
-- Only index non-deleted files for performance
CREATE INDEX idx_file_attachments_entity
  ON public.file_attachments(entity_type, entity_id)
  WHERE deleted_at IS NULL;

-- Index for storage_path lookups (used by RLS on storage.objects)
CREATE INDEX idx_file_attachments_storage_path
  ON public.file_attachments(storage_path);

-- Index for uploaded_by lookups (for user's file history)
CREATE INDEX idx_file_attachments_uploaded_by
  ON public.file_attachments(uploaded_by);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_file_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS file_attachments_update_timestamp ON public.file_attachments;
CREATE TRIGGER file_attachments_update_timestamp
  BEFORE UPDATE ON public.file_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_file_attachments_updated_at();

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- File access mirrors parent entity access
-- ============================================

-- DROP existing policies if any (for idempotency)
DROP POLICY IF EXISTS file_attachments_select ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_insert ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_delete ON public.file_attachments;

-- SELECT: Users can view files if they can view the parent entity
-- Admin, Quartermaster, Finance, Inventory, Proposal, Frontline: all non-deleted files
-- Requester: only files on entities they own
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Privileged roles can see all files
      public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
      OR (
        -- Requester can see files on their own QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmrl'
        AND public.owns_qmrl(entity_id)
      )
      OR (
        -- Requester can see files on QMHQ linked to their QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmhq'
        AND public.owns_qmhq(entity_id)
      )
    )
  );

-- INSERT: Users who can edit the parent entity can upload files
-- Admin, Quartermaster: any entity
-- Proposal, Frontline: qmrl and qmhq entities
-- Requester: own qmrl only (cannot upload to qmhq)
CREATE POLICY file_attachments_insert ON public.file_attachments
  FOR INSERT WITH CHECK (
    -- Admin and Quartermaster can upload to any entity
    public.get_user_role() IN ('admin', 'quartermaster')
    OR (
      -- Proposal and Frontline can upload to any qmrl or qmhq
      public.get_user_role() IN ('proposal', 'frontline')
      AND entity_type IN ('qmrl', 'qmhq')
    )
    OR (
      -- Requester can only upload to their own QMRL
      public.get_user_role() = 'requester'
      AND entity_type = 'qmrl'
      AND public.owns_qmrl(entity_id)
    )
  );

-- UPDATE (soft delete): Admin and Quartermaster only
-- This is used to set deleted_at/deleted_by for soft delete
CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

-- DELETE (hard delete): Admin only - used by cleanup job
-- Normal users should soft-delete via UPDATE
CREATE POLICY file_attachments_delete ON public.file_attachments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- Grant execute on helper functions (already granted in 027_rls_policies.sql)
-- ============================================

-- Comments for documentation
COMMENT ON TABLE public.file_attachments IS 'Metadata for files attached to QMRL/QMHQ entities. Actual files in storage bucket.';
COMMENT ON COLUMN public.file_attachments.entity_type IS 'Type of parent entity: qmrl or qmhq';
COMMENT ON COLUMN public.file_attachments.entity_id IS 'UUID of parent entity (polymorphic, no FK)';
COMMENT ON COLUMN public.file_attachments.filename IS 'Original filename preserved for display';
COMMENT ON COLUMN public.file_attachments.storage_path IS 'Path in storage bucket: {entity_type}/{entity_id}/{filename}_{timestamp}.ext';
COMMENT ON COLUMN public.file_attachments.deleted_at IS 'Soft delete timestamp. NULL = active. 30-day grace before purge.';
