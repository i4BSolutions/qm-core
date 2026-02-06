-- ============================================
-- Migration: 038_fix_file_delete_rpc.sql
-- Description: Create RPC function for file soft-delete that bypasses RLS
-- ============================================
-- The RLS UPDATE policy for file_attachments requires either:
-- 1. Admin/Quartermaster role, OR
-- 2. User is the original uploader
--
-- This fails when a non-uploader user with edit access to the entity
-- tries to delete an attachment. Fix: Use SECURITY DEFINER RPC with
-- explicit authorization checks.
-- ============================================

-- Create the soft-delete RPC function
CREATE OR REPLACE FUNCTION public.soft_delete_file_attachment(
  p_file_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_file RECORD;
  v_user_role TEXT;
  v_can_delete BOOLEAN := FALSE;
BEGIN
  -- Get file info
  SELECT id, entity_type, entity_id, uploaded_by
  INTO v_file
  FROM public.file_attachments
  WHERE id = p_file_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'File not found');
  END IF;

  -- Get user role
  SELECT role::TEXT INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;

  -- Check authorization:
  -- 1. Admin/Quartermaster can delete any file
  IF v_user_role IN ('admin', 'quartermaster') THEN
    v_can_delete := TRUE;
  -- 2. Original uploader can delete their own file
  ELSIF v_file.uploaded_by = p_user_id THEN
    v_can_delete := TRUE;
  -- 3. Users with entity access can delete attachments on that entity
  ELSIF v_file.entity_type = 'qmrl' THEN
    -- Check if user has edit access to the QMRL
    SELECT EXISTS(
      SELECT 1 FROM public.qmrl
      WHERE id = v_file.entity_id
      AND (
        v_user_role IN ('admin', 'quartermaster', 'proposal', 'frontline')
        OR (v_user_role = 'requester' AND requester_id = p_user_id)
      )
    ) INTO v_can_delete;
  ELSIF v_file.entity_type = 'qmhq' THEN
    -- Check if user has edit access to the QMHQ
    SELECT EXISTS(
      SELECT 1 FROM public.qmhq
      WHERE id = v_file.entity_id
      AND v_user_role IN ('admin', 'quartermaster', 'proposal', 'finance', 'inventory')
    ) INTO v_can_delete;
  END IF;

  IF NOT v_can_delete THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Perform soft delete
  UPDATE public.file_attachments
  SET
    deleted_at = NOW(),
    deleted_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_file_id;

  RETURN json_build_object(
    'success', true,
    'entity_type', v_file.entity_type,
    'entity_id', v_file.entity_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.soft_delete_file_attachment(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.soft_delete_file_attachment IS
  'Soft-delete file attachment with explicit authorization checks. Bypasses RLS.';
