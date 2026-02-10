'use client';

/**
 * QMRL Slider Content Component
 *
 * Displays full QMRL details inside the context slider.
 * Shows all fields: ID, title, status, category, priority, date, description, notes,
 * department, contact, attachments, and QMHQ lines count.
 */

import { useState } from 'react';
import {
  FileText,
  Calendar,
  Building2,
  User,
  Tag,
  AlertCircle,
  Paperclip,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { QMRL, StatusConfig, Category, Department, ContactPerson } from '@/types/database';
import type { FileAttachmentWithUploader } from '@/lib/actions/files';

interface QMRLWithRelations extends QMRL {
  status?: StatusConfig | null;
  category?: Category | null;
  department?: Department | null;
  contact_person?: ContactPerson | null;
}

interface QmrlSliderContentProps {
  qmrl: QMRLWithRelations | null;
  isLoading: boolean;
  attachments: FileAttachmentWithUploader[];
  thumbnailUrls: Map<string, string>;
  onAttachmentClick: (file: FileAttachmentWithUploader) => void;
  qmhqLinesCount: number;
}

// Priority configuration
const priorityConfig: Record<string, { class: string; label: string }> = {
  low: { class: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: 'LOW' },
  medium: { class: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'MEDIUM' },
  high: { class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'HIGH' },
  critical: { class: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'CRITICAL' },
};

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * QMRL Slider Content
 *
 * Renders full QMRL details including:
 * - QMRL ID badge
 * - Title and metadata (status, category, priority)
 * - Request date
 * - Description (collapsible if >200 chars)
 * - Notes (collapsible if >200 chars)
 * - Department and contact person
 * - Attachments with thumbnails
 * - QMHQ lines count badge
 */
export function QmrlSliderContent({
  qmrl,
  isLoading,
  attachments,
  thumbnailUrls,
  onAttachmentClick,
  qmhqLinesCount,
}: QmrlSliderContentProps) {
  // UI state for collapsible sections
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // No QMRL selected
  if (!qmrl) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <FileText className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">Select a QMRL to see context</p>
      </div>
    );
  }

  return (
    <>
      {/* QMRL ID Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 w-fit mb-2">
        <code className="text-sm font-mono text-amber-400">{qmrl.request_id}</code>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-slate-200 leading-tight mb-3">
        {qmrl.title}
      </h3>

      {/* Status, Category, Priority */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {qmrl.status && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: qmrl.status.color || 'rgb(100, 116, 139)',
              color: qmrl.status.color || 'rgb(148, 163, 184)',
            }}
          >
            {qmrl.status.name}
          </Badge>
        )}
        {qmrl.category && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: qmrl.category.color || 'rgb(100, 116, 139)',
              color: qmrl.category.color || 'rgb(148, 163, 184)',
            }}
          >
            <Tag className="mr-1 h-3 w-3" />
            {qmrl.category.name}
          </Badge>
        )}
        {qmrl.priority && priorityConfig[qmrl.priority] && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded border',
            priorityConfig[qmrl.priority].class
          )}>
            <AlertCircle className="inline mr-1 h-3 w-3" />
            {priorityConfig[qmrl.priority].label}
          </span>
        )}
      </div>

      {/* Request Date */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Calendar className="h-3.5 w-3.5" />
        <span>Request Date: {formatDate(qmrl.request_date)}</span>
      </div>

      {/* Description (collapsible) */}
      {qmrl.description && (
        <div className="space-y-1 mb-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Description
          </p>
          <p
            className={cn(
              'text-sm text-slate-300 whitespace-pre-wrap',
              !isDescriptionExpanded && 'line-clamp-4'
            )}
          >
            {qmrl.description}
          </p>
          {qmrl.description.length > 200 && (
            <button
              onClick={() => setIsDescriptionExpanded(prev => !prev)}
              className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isDescriptionExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Notes (collapsible) */}
      {qmrl.notes && (
        <div className="space-y-1 mb-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Notes
          </p>
          <p
            className={cn(
              'text-sm text-slate-300 whitespace-pre-wrap',
              !isNotesExpanded && 'line-clamp-4'
            )}
          >
            {qmrl.notes}
          </p>
          {qmrl.notes.length > 200 && (
            <button
              onClick={() => setIsNotesExpanded(prev => !prev)}
              className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isNotesExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Department & Contact */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3 mb-4">
        {qmrl.department && (
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Department</p>
              <p className="text-sm text-slate-200">{qmrl.department.name}</p>
            </div>
          </div>
        )}
        {qmrl.contact_person && (
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Contact Person</p>
              <p className="text-sm text-slate-200">
                {qmrl.contact_person.name}
                {qmrl.contact_person.position && (
                  <span className="text-slate-400"> - {qmrl.contact_person.position}</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Paperclip className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Attachments ({attachments.length})
          </span>
        </div>
        {attachments.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {attachments.map((file) => (
              <button
                key={file.id}
                onClick={() => onAttachmentClick(file)}
                className={cn(
                  'relative aspect-square rounded border border-slate-700 overflow-hidden',
                  'hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/50'
                )}
                title={file.filename}
              >
                {file.mime_type.startsWith('image/') && thumbnailUrls.get(file.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrls.get(file.id)}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    {file.mime_type === 'application/pdf' ? (
                      <FileText className="h-5 w-5 text-red-400" />
                    ) : (
                      <Paperclip className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No attachments</p>
        )}
      </div>

      {/* QMHQ Lines Count Badge */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              QMHQ Lines
            </span>
          </div>
          <span className="text-lg font-mono font-bold text-amber-400">
            {qmhqLinesCount}
          </span>
        </div>
      </div>
    </>
  );
}
