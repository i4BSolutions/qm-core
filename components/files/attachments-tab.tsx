'use client';

/**
 * Attachments Tab Component
 *
 * Orchestrator component that combines all file upload components
 * (dropzone, grid, progress, delete dialog) into a complete attachment workflow.
 * Includes file preview modal for viewing attached files (images and PDFs).
 */

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Paperclip, FileIcon, Download, Loader2 } from 'lucide-react';
import { useFileUpload } from '@/lib/hooks/use-file-upload';
import {
  getFilesByEntity,
  deleteFile,
  getFileUrl,
  type FileAttachmentWithUploader,
} from '@/lib/actions/files';
import { FileDropzone } from './file-dropzone';
import { FileCard } from './file-card';
import { FileGrid } from './file-grid';
import { UploadProgress } from './upload-progress';
import { DeleteFileDialog } from './delete-file-dialog';
import { FilePreviewModal } from './file-preview-modal';
import { ImagePreview } from './image-preview';
import { DownloadAllButton } from './download-all-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/**
 * PDF Preview Skeleton - shown while dynamically loading PDFPreview component
 */
function PDFPreviewSkeleton() {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between gap-4 p-2 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      {/* PDF page skeleton */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
          <span className="text-sm text-slate-400">Loading PDF viewer...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamically import PDFPreview with SSR disabled.
 * CRITICAL: PDF.js worker crashes during SSR, so we must load client-side only.
 */
const PDFPreview = dynamic(
  () => import('./pdf-preview').then((mod) => ({ default: mod.PDFPreview })),
  {
    ssr: false,
    loading: () => <PDFPreviewSkeleton />,
  }
);

interface AttachmentsTabProps {
  entityType: 'qmrl' | 'qmhq';
  entityId: string;
  entityDisplayId: string; // Display ID for ZIP naming (e.g., "QMRL-2025-00001")
  canEdit?: boolean;
  onFileCountChange?: (count: number) => void;
}

/**
 * Attachments tab orchestrator component.
 *
 * Combines all file upload functionality into a single tab:
 * - Loads existing files on mount
 * - Displays file grid with thumbnails
 * - Handles drag-drop upload with progress tracking
 * - Manages delete confirmation flow
 * - Shows loading and empty states
 * - Opens file preview modal on card click (images and PDFs)
 *
 * @param entityType - Entity type ('qmrl' or 'qmhq')
 * @param entityId - Entity UUID
 * @param entityDisplayId - Display ID for ZIP naming (e.g., "QMRL-2025-00001")
 * @param canEdit - Whether user can upload/delete files (default: true)
 * @param onFileCountChange - Callback when file count changes (for tab badge)
 *
 * @example
 * <AttachmentsTab
 *   entityType="qmrl"
 *   entityId={qmrl.id}
 *   entityDisplayId={qmrl.request_id}
 *   canEdit={hasEditPermission}
 *   onFileCountChange={setFileCount}
 * />
 */
export function AttachmentsTab({
  entityType,
  entityId,
  entityDisplayId,
  canEdit = true,
  onFileCountChange,
}: AttachmentsTabProps) {
  // State
  const [files, setFiles] = useState<FileAttachmentWithUploader[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [fileToDelete, setFileToDelete] =
    useState<FileAttachmentWithUploader | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview modal state
  const [previewFile, setPreviewFile] =
    useState<FileAttachmentWithUploader | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // File upload hook
  const { progress, uploadFiles, cancel, clearCompleted } = useFileUpload(
    entityType,
    entityId
  );

  /**
   * Load thumbnail URLs for image files
   */
  const loadThumbnails = useCallback(
    async (fileList: FileAttachmentWithUploader[]) => {
      const newUrls = new Map<string, string>();

      for (const file of fileList) {
        if (file.mime_type.startsWith('image/')) {
          const result = await getFileUrl(file.storage_path);
          if (result.success) {
            newUrls.set(file.id, result.data);
          }
        }
      }

      setThumbnailUrls(newUrls);
    },
    []
  );

  /**
   * Load files from server
   */
  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    const result = await getFilesByEntity(entityType, entityId);

    if (result.success) {
      setFiles(result.data);
      await loadThumbnails(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to load files',
        description: result.error,
      });
    }

    setIsLoading(false);
  }, [entityType, entityId, loadThumbnails]);

  /**
   * Load files on mount
   */
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  /**
   * Update file count when files change
   */
  useEffect(() => {
    onFileCountChange?.(files.length);
  }, [files.length, onFileCountChange]);

  /**
   * Reload files when upload completes
   */
  useEffect(() => {
    // Check if upload just completed (no longer uploading and had files)
    if (!progress.isUploading && progress.total > 0) {
      const hasCompletions = progress.completed > 0;
      const hasFailed = progress.failed > 0;

      if (hasCompletions) {
        // Reload files from server
        loadFiles();

        // Show success/partial success toast
        if (hasFailed) {
          toast({
            title: 'Partial success',
            description: `${progress.completed} uploaded, ${progress.failed} failed`,
          });
        } else {
          toast({
            title: 'Upload successful',
            description: `${progress.completed} file${progress.completed !== 1 ? 's' : ''} uploaded`,
          });
        }

        // Clear completed items after showing toast
        setTimeout(() => clearCompleted(), 2000);
      }
    }
  }, [progress.isUploading, progress.total, progress.completed, progress.failed, loadFiles, clearCompleted]);

  /**
   * Handle file drop/selection
   */
  const handleFilesAccepted = useCallback(
    (acceptedFiles: File[]) => {
      // Check soft limit (20 files total)
      const totalAfterUpload = files.length + acceptedFiles.length;
      if (totalAfterUpload > 20) {
        toast({
          title: 'Many files',
          description: `You'll have ${totalAfterUpload} files. Consider cleaning up old attachments.`,
        });
      }

      // Start upload
      uploadFiles(acceptedFiles);
    },
    [files.length, uploadFiles]
  );

  /**
   * Handle delete click
   */
  const handleDeleteClick = useCallback((file: FileAttachmentWithUploader) => {
    setFileToDelete(file);
  }, []);

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);

    const result = await deleteFile(fileToDelete.id);

    if (result.success) {
      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));

      toast({
        title: 'File deleted',
        description: `${fileToDelete.filename} has been deleted`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: result.error,
      });
    }

    setIsDeleting(false);
    setFileToDelete(null);
  }, [fileToDelete]);

  /**
   * Handle preview open - get signed URL and open modal
   */
  const handlePreviewOpen = useCallback(
    async (file: FileAttachmentWithUploader) => {
      setIsLoadingPreview(true);
      setPreviewFile(file);

      const result = await getFileUrl(file.storage_path);

      if (result.success) {
        setPreviewUrl(result.data);
      } else {
        // Failed to get URL, close preview and show toast
        setPreviewFile(null);
        toast({
          variant: 'destructive',
          title: 'Failed to load file',
          description: result.error,
        });
      }

      setIsLoadingPreview(false);
    },
    []
  );

  /**
   * Handle preview close
   */
  const handlePreviewClose = useCallback(() => {
    setPreviewFile(null);
    setPreviewUrl(null);
  }, []);

  /**
   * Handle image load error in preview
   */
  const handlePreviewError = useCallback(() => {
    handlePreviewClose();
    toast({
      variant: 'destructive',
      title: 'Failed to load image',
      description: 'The image could not be displayed.',
    });
  }, [handlePreviewClose]);

  /**
   * Handle PDF load error in preview
   */
  const handlePdfError = useCallback(() => {
    handlePreviewClose();
    toast({
      variant: 'destructive',
      title: 'Failed to load PDF',
      description: 'The PDF could not be displayed.',
    });
  }, [handlePreviewClose]);

  /**
   * Handle PDF password required
   */
  const handlePdfPasswordRequired = useCallback(() => {
    handlePreviewClose();
    toast({
      title: 'PDF is password protected',
      description: 'Download the file to view it with a PDF reader.',
      action: previewUrl ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(previewUrl, '_blank')}
        >
          Download
        </Button>
      ) : undefined,
    });
  }, [handlePreviewClose, previewUrl]);

  /**
   * Warn before navigation if uploads in progress
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (progress.isUploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [progress.isUploading]);

  /**
   * Determine what to render in the preview modal
   */
  const renderPreviewContent = () => {
    if (!previewFile || !previewUrl) return null;

    const isImage = previewFile.mime_type.startsWith('image/');
    const isPdf = previewFile.mime_type === 'application/pdf';

    if (isImage) {
      return (
        <ImagePreview
          url={previewUrl}
          filename={previewFile.filename}
          onError={handlePreviewError}
        />
      );
    }

    if (isPdf) {
      return (
        <PDFPreview
          url={previewUrl}
          onError={handlePdfError}
          onPasswordRequired={handlePdfPasswordRequired}
          onDownload={() => window.open(previewUrl, '_blank')}
        />
      );
    }

    // Non-previewable files: show placeholder with download button
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <FileIcon className="h-16 w-16 text-slate-500 mb-4" />
        <p className="text-slate-400 mb-2">Preview not available</p>
        <p className="text-sm text-slate-500 mb-4">
          This file type cannot be previewed in the browser.
        </p>
        <Button
          onClick={() => previewUrl && window.open(previewUrl, '_blank')}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download File
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with file count and download all button */}
      <div className="flex items-center justify-between">
        <div className="section-header">
          <Paperclip className="h-4 w-4 text-amber-500" />
          <h3>Attachments ({files.length})</h3>
        </div>
        <DownloadAllButton files={files} entityId={entityDisplayId} />
      </div>

      {/* Upload Progress (only show when uploading) */}
      {progress.isUploading && (
        <UploadProgress
          completed={progress.completed}
          total={progress.total}
          failed={progress.failed}
          onCancel={cancel}
        />
      )}

      {/* File Grid */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No files attached</p>
        </div>
      ) : (
        <FileGrid>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              thumbnailUrl={thumbnailUrls.get(file.id)}
              canDelete={canEdit}
              onDelete={() => handleDeleteClick(file)}
              onPreview={() => handlePreviewOpen(file)}
            />
          ))}
        </FileGrid>
      )}

      {/* Drop Zone (only if canEdit) */}
      {canEdit && (
        <FileDropzone
          onFilesAccepted={handleFilesAccepted}
          disabled={progress.isUploading}
        />
      )}

      {/* Delete Dialog */}
      <DeleteFileDialog
        open={!!fileToDelete}
        onOpenChange={(open) => !open && setFileToDelete(null)}
        filename={fileToDelete?.filename ?? ''}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={handlePreviewClose}
        file={previewFile}
        fileUrl={previewUrl}
      >
        {renderPreviewContent()}
      </FilePreviewModal>
    </div>
  );
}
