'use client';

/**
 * Staged Files Hook
 *
 * Custom hook for managing files staged for upload before an entity exists.
 * Used in the Upload-After-Create pattern where files are held in React state
 * during form editing, then uploaded sequentially after entity creation.
 *
 * Memory management is critical: Blob URLs persist until explicitly revoked.
 * This hook properly revokes URLs on removal, clear, and unmount.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Represents a file staged for upload with an optional preview URL.
 */
export interface StagedFile {
  /** Unique identifier for React key (crypto.randomUUID()) */
  id: string;
  /** The actual File object to upload */
  file: File;
  /** Blob URL for image preview (undefined for non-images) */
  previewUrl?: string;
}

/**
 * Custom hook for managing files staged for upload.
 *
 * Provides state management for files that will be uploaded after entity creation.
 * Generates preview URLs for images and properly cleans up blob URLs.
 *
 * @returns Object with files array and control methods
 *
 * @example
 * const { files, addFiles, removeFile, clearFiles, getFilesForUpload } = useStagedFiles();
 *
 * // Add files from dropzone
 * addFiles(acceptedFiles);
 *
 * // Remove a single file
 * removeFile(fileId);
 *
 * // Get raw File objects for upload
 * const filesToUpload = getFilesForUpload();
 */
export function useStagedFiles() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  // Track all created URLs for cleanup on unmount
  const urlsRef = useRef<Set<string>>(new Set());

  /**
   * Adds files to the staged files list.
   * Generates preview URLs for image files only.
   */
  const addFiles = useCallback((newFiles: File[]) => {
    const stagedFiles: StagedFile[] = newFiles.map((file) => {
      let previewUrl: string | undefined;

      // Generate preview URL only for images
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
        urlsRef.current.add(previewUrl);
      }

      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
      };
    });

    setFiles((prev) => [...prev, ...stagedFiles]);
  }, []);

  /**
   * Removes a file from the staged files list.
   * Revokes the preview URL to prevent memory leaks.
   */
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
        urlsRef.current.delete(fileToRemove.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  /**
   * Clears all staged files.
   * Revokes all preview URLs to prevent memory leaks.
   */
  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
          urlsRef.current.delete(f.previewUrl);
        }
      });
      return [];
    });
  }, []);

  /**
   * Gets the raw File objects for upload.
   * Use this when ready to upload after entity creation.
   */
  const getFilesForUpload = useCallback((): File[] => {
    return files.map((f) => f.file);
  }, [files]);

  /**
   * Cleanup effect: Revoke all URLs on unmount.
   * This prevents memory leaks if the component unmounts before files are cleared.
   */
  useEffect(() => {
    const currentUrls = urlsRef.current;
    return () => {
      currentUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      currentUrls.clear();
    };
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    getFilesForUpload,
  };
}
