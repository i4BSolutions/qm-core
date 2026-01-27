'use client';

/**
 * File Card Component
 *
 * Displays a single file attachment with thumbnail preview or extension badge.
 * Shows file metadata and optional delete action.
 * Clickable to open file preview.
 */

import { MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatFileSize, getFileExtension } from '@/lib/utils/file-validation';
import type { FileAttachmentWithUploader } from '@/lib/actions/files';

interface FileCardProps {
  file: FileAttachmentWithUploader;
  thumbnailUrl?: string;
  onDelete?: () => void;
  onPreview?: () => void;
  canDelete?: boolean;
}

/**
 * Color scheme for file extension badges
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

/**
 * File card component displaying file information and thumbnail/badge.
 *
 * Features:
 * - Thumbnail preview for images
 * - Colored extension badges for documents
 * - File metadata (name, size, date, uploader)
 * - Click to open file preview
 * - Optional delete action via context menu
 *
 * @param file - The file attachment to display
 * @param thumbnailUrl - Optional thumbnail URL for images
 * @param onDelete - Callback when delete is clicked
 * @param onPreview - Callback when card is clicked to open preview
 * @param canDelete - Whether to show delete option
 *
 * @example
 * <FileCard
 *   file={fileAttachment}
 *   thumbnailUrl={signedUrl}
 *   onDelete={() => handleDelete(fileAttachment.id)}
 *   onPreview={() => handlePreview(fileAttachment)}
 *   canDelete={true}
 * />
 */
export function FileCard({
  file,
  thumbnailUrl,
  onDelete,
  onPreview,
  canDelete,
}: FileCardProps) {
  const extension = getFileExtension(file.filename);
  const isImage = file.mime_type.startsWith('image/');
  const colors = EXTENSION_COLORS[extension] || {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
  };

  /**
   * Format date for display
   */
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  /**
   * Handle card click - opens preview
   */
  const handleCardClick = () => {
    if (onPreview) {
      onPreview();
    }
  };

  /**
   * Handle dropdown click - prevent card click propagation
   */
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden hover:border-slate-600 transition-colors',
        onPreview && 'cursor-pointer'
      )}
      onClick={handleCardClick}
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onKeyDown={
        onPreview
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
    >
      {/* Thumbnail / Extension Badge Area */}
      <div className="h-24 flex items-center justify-center bg-slate-900/50">
        {isImage && thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={file.filename}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              colors.bg
            )}
          >
            <span className={cn('text-2xl font-bold uppercase', colors.text)}>
              {extension.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="p-3 space-y-1">
        <p className="text-sm text-slate-200 truncate" title={file.filename}>
          {file.filename}
        </p>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatFileSize(file.file_size)}</span>
          <span>{formatDate(file.uploaded_at)}</span>
        </div>
        {file.uploaded_by_user && (
          <p className="text-xs text-slate-500 truncate">
            {file.uploaded_by_user.full_name}
          </p>
        )}
      </div>

      {/* Action Menu */}
      {canDelete && onDelete && (
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDropdownClick}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-600">
                <MoreVertical className="h-4 w-4 text-slate-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-400 focus:text-red-400 cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
