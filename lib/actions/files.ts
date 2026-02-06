'use server';

/**
 * File Server Actions
 *
 * Server actions for file upload, delete, and retrieval operations.
 * These actions work with Supabase Storage and the file_attachments table.
 */

import { createClient } from '@/lib/supabase/server';
import {
  validateFile,
  generateStoragePath,
  getMimeType,
} from '@/lib/utils/file-validation';
import { revalidatePath } from 'next/cache';
import type { FileAttachment } from '@/types/database';

/**
 * Result type for file operations
 */
export type FileOperationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * File attachment with uploader details
 */
export interface FileAttachmentWithUploader extends FileAttachment {
  uploaded_by_user?: {
    full_name: string;
    email: string;
  } | null;
}

/**
 * Uploads a file to Supabase Storage and creates a file_attachments record.
 *
 * This action performs atomic-like operations:
 * 1. Validates the file (extension and size)
 * 2. Uploads to Supabase Storage
 * 3. Creates metadata record in file_attachments table
 * 4. If metadata creation fails, removes the uploaded file
 *
 * @param formData - FormData containing the file under key 'file'
 * @param entityType - The type of entity to attach to ('qmrl' or 'qmhq')
 * @param entityId - The UUID of the entity to attach to
 * @returns FileOperationResult with the created FileAttachment or error message
 *
 * @example
 * const formData = new FormData();
 * formData.append('file', file);
 * const result = await uploadFile(formData, 'qmrl', 'uuid-here');
 */
export async function uploadFile(
  formData: FormData,
  entityType: 'qmrl' | 'qmhq',
  entityId: string
): Promise<FileOperationResult<FileAttachment>> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get file from form data
    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file
    const validation = validateFile(file.name, file.size);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate storage path
    const storagePath = generateStoragePath(entityType, entityId, file.name);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`,
      };
    }

    // Create metadata record
    const { data, error: insertError } = await supabase
      .from('file_attachments')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: getMimeType(file.name),
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('attachments').remove([storagePath]);
      return {
        success: false,
        error: `Failed to save file record: ${insertError.message}`,
      };
    }

    revalidatePath(`/${entityType}/${entityId}`);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Soft-deletes a file attachment by setting deleted_at timestamp.
 *
 * The actual storage object is NOT deleted - it will be cleaned up
 * by the cleanup-expired-files Edge Function after the 30-day grace period.
 *
 * Uses an RPC function with SECURITY DEFINER to bypass RLS and perform
 * explicit authorization checks (admin/quartermaster, uploader, or entity access).
 *
 * @param fileId - The UUID of the file_attachments record to soft-delete
 * @returns FileOperationResult with success or error message
 *
 * @example
 * const result = await deleteFile('file-uuid-here');
 */
export async function deleteFile(
  fileId: string
): Promise<FileOperationResult<void>> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use RPC function for soft-delete (bypasses RLS with explicit auth checks)
    const rpcCall = supabase.rpc as (
      fn: string,
      args: Record<string, unknown>
    ) => ReturnType<typeof supabase.rpc>;
    const { data, error: rpcError } = await rpcCall(
      'soft_delete_file_attachment',
      {
        p_file_id: fileId,
        p_user_id: user.id,
      }
    );

    if (rpcError) {
      return { success: false, error: `Delete failed: ${rpcError.message}` };
    }

    // Parse RPC response
    const result = data as { success: boolean; error?: string; entity_type?: string; entity_id?: string };

    if (!result.success) {
      return { success: false, error: result.error || 'Delete failed' };
    }

    // Revalidate the entity page
    // Note: Storage object NOT deleted - cleanup job handles after 30 days
    if (result.entity_type && result.entity_id) {
      revalidatePath(`/${result.entity_type}/${result.entity_id}`);
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Retrieves all non-deleted file attachments for a specific entity.
 *
 * Returns files ordered by upload date (newest first) with uploader details.
 *
 * @param entityType - The type of entity ('qmrl' or 'qmhq')
 * @param entityId - The UUID of the entity
 * @returns FileOperationResult with array of FileAttachments or error message
 *
 * @example
 * const result = await getFilesByEntity('qmrl', 'uuid-here');
 * if (result.success) {
 *   console.log(result.data); // FileAttachment[]
 * }
 */
export async function getFilesByEntity(
  entityType: 'qmrl' | 'qmhq',
  entityId: string
): Promise<FileOperationResult<FileAttachmentWithUploader[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('file_attachments')
      .select('*, uploaded_by_user:users!uploaded_by(full_name, email)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Generates a signed URL for downloading/viewing a file.
 *
 * The URL is valid for 1 hour and provides temporary authenticated access
 * to the file in Supabase Storage.
 *
 * @param storagePath - The storage path of the file (from file_attachments.storage_path)
 * @returns FileOperationResult with the signed URL or error message
 *
 * @example
 * const result = await getFileUrl('qmrl/uuid/filename_123.pdf');
 * if (result.success) {
 *   window.open(result.data, '_blank');
 * }
 */
export async function getFileUrl(
  storagePath: string
): Promise<FileOperationResult<string>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.signedUrl };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Gets a single file attachment by ID.
 *
 * @param fileId - The UUID of the file_attachments record
 * @returns FileOperationResult with the FileAttachment or error message
 *
 * @example
 * const result = await getFileById('file-uuid-here');
 */
export async function getFileById(
  fileId: string
): Promise<FileOperationResult<FileAttachmentWithUploader>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('file_attachments')
      .select('*, uploaded_by_user:users!uploaded_by(full_name, email)')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
