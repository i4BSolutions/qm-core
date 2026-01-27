'use client';

/**
 * File Upload Hook
 *
 * Custom hook for managing file upload state with retry logic and batch processing.
 * Provides state management for multi-file uploads with sequential processing.
 */

import { useState, useRef, useCallback } from 'react';
import { uploadFile } from '@/lib/actions/files';
import type { FileAttachment } from '@/types/database';

/**
 * Possible states for a file upload
 */
export type UploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Individual file upload item with state tracking
 */
export interface FileUploadItem {
  id: string;
  file: File;
  state: UploadState;
  error?: string;
  retryCount: number;
  result?: FileAttachment;
}

/**
 * Overall upload progress metrics
 */
export interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  isUploading: boolean;
}

/**
 * Custom hook for managing file uploads with retry logic.
 *
 * Processes files sequentially to avoid overwhelming the server.
 * Provides automatic retry with exponential backoff (1s, 2s, 4s).
 *
 * @param entityType - The type of entity to attach files to ('qmrl' or 'qmhq')
 * @param entityId - The UUID of the entity
 * @returns Upload state and control methods
 *
 * @example
 * const { items, progress, uploadFiles, cancel } = useFileUpload('qmrl', qmrlId);
 *
 * // Start uploading files
 * await uploadFiles([file1, file2, file3]);
 */
export function useFileUpload(
  entityType: 'qmrl' | 'qmhq',
  entityId: string
) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Uploads a single file with retry logic.
   * Retries up to maxRetries times with exponential backoff delays.
   */
  const uploadWithRetry = async (
    item: FileUploadItem,
    maxRetries: number = 3
  ): Promise<void> => {
    // Check if upload was cancelled
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    // Update state to uploading
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, state: 'uploading' as UploadState } : i
      )
    );

    try {
      // Create FormData for server action
      const formData = new FormData();
      formData.append('file', item.file);

      // Call upload server action
      const result = await uploadFile(formData, entityType, entityId);

      if (result.success) {
        // Success - update item with result
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  state: 'success' as UploadState,
                  result: result.data,
                }
              : i
          )
        );
      } else {
        // Upload failed
        if (item.retryCount < maxRetries) {
          // Retry with exponential backoff
          const delay = Math.pow(2, item.retryCount) * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Update retry count and try again
          const updatedItem = { ...item, retryCount: item.retryCount + 1 };
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? updatedItem : i))
          );

          // Check again if cancelled during delay
          if (!abortControllerRef.current?.signal.aborted) {
            await uploadWithRetry(updatedItem, maxRetries);
          }
        } else {
          // Max retries reached - mark as error
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    state: 'error' as UploadState,
                    error: result.error,
                  }
                : i
            )
          );
        }
      }
    } catch (error) {
      // Unexpected error
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                state: 'error' as UploadState,
                error:
                  error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred',
              }
            : i
        )
      );
    }
  };

  /**
   * Uploads multiple files sequentially.
   * Adds files to the queue and processes them one by one.
   */
  const uploadFiles = useCallback(
    async (files: File[]) => {
      // Create new upload items
      const newItems: FileUploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        state: 'idle' as UploadState,
        retryCount: 0,
      }));

      // Add to items state
      setItems((prev) => [...prev, ...newItems]);

      // Create abort controller for this batch
      abortControllerRef.current = new AbortController();

      // Process files sequentially
      for (const item of newItems) {
        // Check if cancelled
        if (abortControllerRef.current.signal.aborted) {
          break;
        }

        await uploadWithRetry(item);
      }

      // Clear abort controller
      abortControllerRef.current = null;
    },
    [entityType, entityId]
  );

  /**
   * Cancels all remaining uploads in the queue.
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Removes completed and failed items from the state.
   */
  const clearCompleted = useCallback(() => {
    setItems((prev) =>
      prev.filter((item) => item.state !== 'success' && item.state !== 'error')
    );
  }, []);

  /**
   * Calculate progress metrics from current items
   */
  const progress: UploadProgress = {
    total: items.length,
    completed: items.filter((i) => i.state === 'success').length,
    failed: items.filter((i) => i.state === 'error').length,
    isUploading: items.some(
      (i) => i.state === 'uploading' || i.state === 'idle'
    ),
  };

  return {
    items,
    progress,
    uploadFiles,
    cancel,
    clearCompleted,
    isUploading: progress.isUploading,
  };
}
