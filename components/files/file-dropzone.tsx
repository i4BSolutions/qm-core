'use client';

/**
 * File Dropzone Component
 *
 * Drag-and-drop file upload zone with validation and visual feedback.
 * Uses react-dropzone for handling browser drag-drop events.
 */

import { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
  getAllowedTypesDisplay,
} from '@/lib/utils/file-validation';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * File dropzone component with drag-drop support.
 *
 * Features:
 * - Drag and drop files or click to browse
 * - Visual feedback for drag states (active, reject)
 * - File type and size validation
 * - Toast notifications for rejected files
 *
 * @param onFilesAccepted - Callback when valid files are accepted
 * @param disabled - Whether the dropzone is disabled
 * @param className - Additional CSS classes
 *
 * @example
 * <FileDropzone
 *   onFilesAccepted={(files) => uploadFiles(files)}
 *   disabled={isUploading}
 * />
 */
export function FileDropzone({
  onFilesAccepted,
  disabled,
  className,
}: FileDropzoneProps) {
  /**
   * Handle file drop/selection
   */
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map(({ file, errors }) => {
          const reasons = errors
            .map((e) => {
              if (e.code === 'file-too-large') {
                return `exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`;
              }
              if (e.code === 'file-invalid-type') {
                return 'file type not allowed';
              }
              return e.message;
            })
            .join(', ');
          return `${file.name}: ${reasons}`;
        });

        toast({
          variant: 'destructive',
          title: 'Some files were rejected',
          description: errors.join('\n'),
        });
      }

      // Process accepted files
      if (acceptedFiles.length > 0) {
        onFilesAccepted(acceptedFiles);
      }
    },
    [onFilesAccepted]
  );

  /**
   * Build accept object from EXTENSION_MIME_MAP
   */
  const acceptMimeTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      '.docx',
    ],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
      '.xlsx',
    ],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      ['.pptx'],
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: acceptMimeTypes,
      maxSize: MAX_FILE_SIZE,
      multiple: true,
      disabled,
    });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'h-[180px] border-2 border-dashed rounded-lg transition-all cursor-pointer',
        'flex flex-col items-center justify-center gap-2',
        isDragActive &&
          !isDragReject &&
          'border-amber-500 bg-amber-500/10',
        isDragReject && 'border-red-500 bg-red-500/10',
        !isDragActive &&
          'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />

      {isDragReject ? (
        <>
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">File type not supported</p>
        </>
      ) : isDragActive ? (
        <>
          <Upload className="h-8 w-8 text-amber-400 animate-bounce" />
          <p className="text-sm text-amber-400">Drop files here</p>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-300">
            Drag files here or click to browse
          </p>
          <p className="text-xs text-slate-400">
            Accepted: {getAllowedTypesDisplay()}. Max{' '}
            {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </>
      )}
    </div>
  );
}
