-- ============================================
-- Migration: 032_file_cascade_cleanup.sql
-- Description: Cascade soft-delete triggers and cleanup functions for file attachments
-- Phase: 02-file-storage-foundation
-- ============================================
-- This migration implements:
-- 1. Cascade soft-delete: When QMRL/QMHQ is soft-deleted (is_active = false),
--    all attached files are also soft-deleted (deleted_at set)
-- 2. Cleanup helper functions called by Edge Function to purge expired files
--
-- Grace Period: 30 days from soft-delete before permanent purge
-- Cleanup Flow:
--   1. Edge Function calls get_expired_file_paths() to get paths
--   2. Edge Function removes storage objects via Storage API
--   3. Edge Function calls purge_expired_file_metadata() to delete metadata
-- ============================================

-- ============================================
-- Cascade Soft-Delete Function
-- ============================================
-- Triggers when parent entity (QMRL/QMHQ) is soft-deleted
-- Sets deleted_at and deleted_by on all attached files
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_files()
RETURNS TRIGGER AS $$
BEGIN
  -- Only cascade when entity is being soft-deleted
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.file_attachments
    SET
      deleted_at = NOW(),
      deleted_by = auth.uid(),
      updated_at = NOW()
    WHERE
      entity_type = TG_ARGV[0]  -- 'qmrl' or 'qmhq' passed as trigger argument
      AND entity_id = NEW.id
      AND deleted_at IS NULL;   -- Only soft-delete files that aren't already deleted
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Apply Cascade Triggers to QMRL and QMHQ
-- ============================================

-- Trigger on QMRL soft-delete
DROP TRIGGER IF EXISTS qmrl_cascade_soft_delete_files ON public.qmrl;
CREATE TRIGGER qmrl_cascade_soft_delete_files
  AFTER UPDATE OF is_active ON public.qmrl
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_files('qmrl');

-- Trigger on QMHQ soft-delete
DROP TRIGGER IF EXISTS qmhq_cascade_soft_delete_files ON public.qmhq;
CREATE TRIGGER qmhq_cascade_soft_delete_files
  AFTER UPDATE OF is_active ON public.qmhq
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_files('qmhq');

-- ============================================
-- Cleanup Helper Functions (for Edge Function)
-- ============================================

-- Get expired file paths (soft-deleted > 30 days ago)
-- Returns id and storage_path for files ready to purge
CREATE OR REPLACE FUNCTION public.get_expired_file_paths()
RETURNS TABLE(id UUID, storage_path TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT fa.id, fa.storage_path
  FROM public.file_attachments fa
  WHERE fa.deleted_at IS NOT NULL
    AND fa.deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Purge expired file metadata after storage objects have been deleted
-- Called by Edge Function after successfully removing storage objects
-- Returns count of deleted metadata records
CREATE OR REPLACE FUNCTION public.purge_expired_file_metadata()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.file_attachments
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grant Permissions
-- ============================================
-- These functions are called by Edge Function with service role
-- Also grant to authenticated for potential admin UI usage
GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_files() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expired_file_paths() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_file_metadata() TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON FUNCTION public.cascade_soft_delete_files() IS 'Cascade soft-delete to file_attachments when parent entity is deactivated';
COMMENT ON FUNCTION public.get_expired_file_paths() IS 'Returns files soft-deleted > 30 days ago for cleanup';
COMMENT ON FUNCTION public.purge_expired_file_metadata() IS 'Hard-delete file metadata after storage objects removed';
COMMENT ON TRIGGER qmrl_cascade_soft_delete_files ON public.qmrl IS 'Cascade soft-delete files when QMRL deactivated';
COMMENT ON TRIGGER qmhq_cascade_soft_delete_files ON public.qmhq IS 'Cascade soft-delete files when QMHQ deactivated';
