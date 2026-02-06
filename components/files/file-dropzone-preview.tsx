'use client';

/**
 * File Dropzone with Preview Component
 *
 * Combines a drag-and-drop file upload zone with a preview grid for staged files.
 * Displays image thumbnails for images and extension badges for other file types.
 * Uses react-dropzone for handling browser drag-drop events.
 */

import { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import {
  MAX_FILE_SIZE,
  formatFileSize,
  getFileExtension,
  getAllowedTypesDisplay,
} from '@/lib/utils/file-validation';
import type { StagedFile } from '@/lib/hooks/use-staged-files';

/**
 * Color configuration for file extension badges.
 */
const EXTENSION_COLORS: Record<string, { bg: string; text: string }> = {
  '.pdf': { bg: 'bg-red-500/20', text: 'text-red-400' },
  '.doc': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '.docx': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '.xls': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  '.xlsx': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  '.ppt': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  '.pptx': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

const DEFAULT_EXTENSION_COLORS = { bg: 'bg-slate-500/20', text: 'text-slate-400' };

interface FileDropzonePreviewProps {
  /** Array of staged files to display in preview grid */
  files: StagedFile[];
  /** Callback when new files are added via dropzone */
  onFilesAdd: (files: File[]) => void;
  /** Callback when a file is removed from preview */
  onFileRemove: (id: string) => void;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
}

/**
 * File dropzone component with preview grid.
 *
 * Features:
 * - Drag and drop files or click to browse
 * - Visual feedback for drag states (active, reject)
 * - Preview grid showing staged files
 * - Image thumbnails or extension badges
 * - Remove button on each file card
 *
 * @example
 * <FileDropzonePreview
 *   files={stagedFiles}
 *   onFilesAdd={addFiles}
 *   onFileRemove={removeFile}
 *   disabled={isSubmitting}
 * />
 */
export function FileDropzonePreview({
  files,
  onFilesAdd,
  onFileRemove,
  disabled,
}: FileDropzonePreviewProps) {
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
        onFilesAdd(acceptedFiles);
      }
    },
    [onFilesAdd]
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

  /**
   * Get extension colors for a file
   */
  const getExtensionColors = (filename: string) => {
    const ext = getFileExtension(filename);
    return EXTENSION_COLORS[ext] || DEFAULT_EXTENSION_COLORS;
  };

  return (
    <div className="space-y-4">
      {/* Dropzone area */}
      <div
        {...getRootProps()}
        className={cn(
          'h-[140px] border-2 border-dashed rounded-lg transition-all cursor-pointer',
          'flex flex-col items-center justify-center gap-2',
          isDragActive &&
            !isDragReject &&
            'border-amber-500 bg-amber-500/10',
          isDragReject && 'border-red-500 bg-red-500/10',
          !isDragActive &&
            'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
          disabled && 'opacity-50 cursor-not-allowed'
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

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {files.map((stagedFile) => {
            const isImage = stagedFile.file.type.startsWith('image/');
            const ext = getFileExtension(stagedFile.file.name);
            const colors = getExtensionColors(stagedFile.file.name);

            return (
              <div
                key={stagedFile.id}
                className="relative rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden group"
              >
                {/* Thumbnail area */}
                <div className="h-20 flex items-center justify-center bg-slate-900/50">
                  {isImage && stagedFile.previewUrl ? (
                    <img
                      src={stagedFile.previewUrl}
                      alt={stagedFile.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className={cn(
                        'px-3 py-1.5 rounded-md font-mono text-sm font-medium uppercase',
                        colors.bg,
                        colors.text
                      )}
                    >
                      {ext.slice(1) || 'file'}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="p-2 border-t border-slate-700">
                  <p
                    className="text-xs text-slate-200 truncate"
                    title={stagedFile.file.name}
                  >
                    {stagedFile.file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(stagedFile.file.size)}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onFileRemove(stagedFile.id)}
                  disabled={disabled}
                  className={cn(
                    'absolute top-1 right-1 p-1 rounded',
                    'bg-slate-800/80 hover:bg-red-500/80 transition-colors',
                    'opacity-0 group-hover:opacity-100',
                    disabled && 'cursor-not-allowed'
                  )}
                >
                  <X className="h-3 w-3 text-slate-300" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
