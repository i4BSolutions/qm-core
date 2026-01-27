'use client';

/**
 * File Preview Modal Component
 *
 * Modal container for previewing file attachments with metadata sidebar.
 * Supports images, PDFs (via children), and fallback for other file types.
 */

import { useEffect, useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Download,
  Calendar,
  User,
  FileText,
  HardDrive,
} from 'lucide-react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/utils/file-validation';
import type { FileAttachmentWithUploader } from '@/lib/actions/files';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileAttachmentWithUploader | null;
  fileUrl: string | null;
  children?: React.ReactNode;
}

/**
 * Format date for display in metadata sidebar
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * File Preview Modal
 *
 * Large overlay modal for viewing file attachments.
 * Features:
 * - Two-column layout: main content area + metadata sidebar
 * - Collapsible sidebar with file metadata
 * - Download button
 * - Close via X button, outside click, or Escape key
 *
 * @param isOpen - Whether the modal is open
 * @param onClose - Callback when modal should close
 * @param file - The file attachment to preview
 * @param fileUrl - Signed URL for the file
 * @param children - Content slot for image/PDF viewer
 *
 * @example
 * <FilePreviewModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   file={selectedFile}
 *   fileUrl={signedUrl}
 * >
 *   <ImagePreview url={signedUrl} filename={file.filename} onError={handleError} />
 * </FilePreviewModal>
 */
export function FilePreviewModal({
  isOpen,
  onClose,
  file,
  fileUrl,
  children,
}: FilePreviewModalProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Reset sidebar visibility when modal opens
  useEffect(() => {
    if (isOpen) {
      setSidebarVisible(true);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle download
  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'max-w-[90vw] max-h-[90vh] w-full h-full',
            'flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900',
            'shadow-2xl shadow-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
          onPointerDownOutside={onClose}
        >
          {/* Main Content Area */}
          <div className="relative flex-1 flex flex-col bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-sm font-medium text-slate-200 truncate max-w-md" title={file.filename}>
                {file.filename}
              </h2>
              <div className="flex items-center gap-2">
                {/* Sidebar Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarVisible(!sidebarVisible)}
                  className="text-slate-400 hover:text-slate-200"
                  title={sidebarVisible ? 'Hide details' : 'Show details'}
                >
                  {sidebarVisible ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-200"
                  title="Close preview"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4">
              {children}
            </div>
          </div>

          {/* Metadata Sidebar */}
          <div
            className={cn(
              'w-80 border-l border-slate-800 bg-slate-900 flex flex-col transition-all duration-200',
              !sidebarVisible && 'w-0 overflow-hidden border-l-0'
            )}
          >
            {sidebarVisible && (
              <>
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200">
                    File Details
                  </h3>
                </div>

                {/* Metadata */}
                <div className="flex-1 p-4 space-y-4 overflow-auto">
                  {/* Filename */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Filename</span>
                    </div>
                    <p
                      className="text-sm text-slate-200 truncate"
                      title={file.filename}
                    >
                      {file.filename}
                    </p>
                  </div>

                  {/* File Size */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>Size</span>
                    </div>
                    <p className="text-sm text-slate-200">
                      {formatFileSize(file.file_size)}
                    </p>
                  </div>

                  {/* Upload Date */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Uploaded</span>
                    </div>
                    <p className="text-sm text-slate-200">
                      {formatDate(file.uploaded_at)}
                    </p>
                  </div>

                  {/* Uploader */}
                  {file.uploaded_by_user && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <User className="h-3.5 w-3.5" />
                        <span>Uploaded by</span>
                      </div>
                      <p className="text-sm text-slate-200">
                        {file.uploaded_by_user.full_name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Download Button */}
                <div className="p-4 border-t border-slate-800">
                  <Button
                    onClick={handleDownload}
                    className="w-full"
                    disabled={!fileUrl}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
