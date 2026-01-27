-- ============================================
-- Migration: 031_storage_bucket_rls.sql
-- Description: Create 'attachments' storage bucket and RLS policies on storage.objects
-- Phase: 02-file-storage-foundation
-- ============================================
-- This migration:
-- 1. Creates a private 'attachments' bucket with file size and MIME type restrictions
-- 2. Sets up RLS policies on storage.objects for secure file access
-- 3. Uses storage.foldername() to extract entity type/ID from file paths
--
-- Path format: {entity_type}/{entity_id}/{filename}_{timestamp}.ext
-- Example: qmrl/123e4567-e89b-12d3-a456-426614174000/report_1706380800000.pdf
-- ============================================

-- ============================================
-- Create 'attachments' bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,  -- Private bucket - all access via RLS
  26214400,  -- 25MB in bytes (25 * 1024 * 1024)
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    -- PDF
    'application/pdf',
    -- Office modern formats
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          -- .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',  -- .pptx
    -- Office legacy formats
    'application/msword',              -- .doc
    'application/vnd.ms-excel',        -- .xls
    'application/vnd.ms-powerpoint'    -- .ppt
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- RLS Policies on storage.objects
-- ============================================
-- Note: Supabase Storage uses storage.objects table for file metadata
-- RLS on this table controls who can read/write files in buckets
-- We use storage.foldername(name) to extract path components:
--   storage.foldername(name)[1] = entity_type ('qmrl' or 'qmhq')
--   storage.foldername(name)[2] = entity_id (UUID)

-- Drop existing policies for 'attachments' bucket (idempotency)
DROP POLICY IF EXISTS storage_attachments_select ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_update ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_delete ON storage.objects;

-- ============================================
-- SELECT Policy: Download files
-- ============================================
-- Users can download files if:
-- 1. File exists in file_attachments with matching storage_path
-- 2. File is not soft-deleted (deleted_at IS NULL)
-- 3. User can access parent entity (same logic as file_attachments SELECT)
CREATE POLICY storage_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.file_attachments fa
      WHERE fa.storage_path = name
        AND fa.deleted_at IS NULL
        AND (
          -- Privileged roles can access all files
          public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          OR (
            -- Requester can access files on their own QMRL
            public.get_user_role() = 'requester'
            AND fa.entity_type = 'qmrl'
            AND public.owns_qmrl(fa.entity_id)
          )
          OR (
            -- Requester can access files on QMHQ linked to their QMRL
            public.get_user_role() = 'requester'
            AND fa.entity_type = 'qmhq'
            AND public.owns_qmhq(fa.entity_id)
          )
        )
    )
  );

-- ============================================
-- INSERT Policy: Upload files
-- ============================================
-- Users can upload files if:
-- 1. They have permission to add files to the target entity
-- 2. Path follows format: {entity_type}/{entity_id}/*
-- Note: File metadata must be created in file_attachments table separately
-- Path components: storage.foldername(name) returns array
--   [1] = entity_type, [2] = entity_id
CREATE POLICY storage_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      -- Admin and Quartermaster can upload to any entity path
      public.get_user_role() IN ('admin', 'quartermaster')
      OR (
        -- Proposal and Frontline can upload to qmrl or qmhq paths
        public.get_user_role() IN ('proposal', 'frontline')
        AND (storage.foldername(name))[1] IN ('qmrl', 'qmhq')
      )
      OR (
        -- Requester can only upload to their own QMRL paths
        public.get_user_role() = 'requester'
        AND (storage.foldername(name))[1] = 'qmrl'
        AND public.owns_qmrl(((storage.foldername(name))[2])::uuid)
      )
    )
  );

-- ============================================
-- UPDATE Policy: Update file metadata (rarely used)
-- ============================================
-- Only Admin and Quartermaster can update file metadata in storage
CREATE POLICY storage_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- DELETE Policy: Remove files from storage
-- ============================================
-- Only Admin and Quartermaster can delete files
-- This is used by the cleanup job to remove expired soft-deleted files
CREATE POLICY storage_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE storage.buckets IS 'Supabase Storage bucket configuration';
