'use client';

/**
 * QMRL Context Panel Component
 *
 * Side panel for displaying parent QMRL details during QMHQ creation.
 * Shows QMRL information, attachments with previews, and existing QMHQ lines.
 *
 * Desktop: Always visible on right side of form
 * Mobile: Slide-in drawer from right with toggle button
 */

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText,
  Calendar,
  Building2,
  User,
  Tag,
  AlertCircle,
  Paperclip,
  Package,
  Wallet,
  ShoppingCart,
  ExternalLink,
  Loader2,
  FileIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getFileUrl, type FileAttachmentWithUploader } from '@/lib/actions/files';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FilePreviewModal } from '@/components/files/file-preview-modal';
import { ImagePreview } from '@/components/files/image-preview';
import { cn } from '@/lib/utils';
import type { QMRL, QMHQ, StatusConfig, Category, Department, ContactPerson } from '@/types/database';

// Dynamically import PDFPreview with SSR disabled
const PDFPreview = dynamic(
  () => import('@/components/files/pdf-preview').then((mod) => ({ default: mod.PDFPreview })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    ),
  }
);

interface QMRLWithRelations extends QMRL {
  status?: StatusConfig | null;
  category?: Category | null;
  department?: Department | null;
  contact_person?: ContactPerson | null;
}

interface QMHQRelated {
  id: string;
  request_id: string;
  line_name: string;
  route_type: 'item' | 'expense' | 'po';
}

interface QmrlContextPanelProps {
  qmrlId: string | null;
}

// Route type configuration for QMHQ display
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: 'Item', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
  expense: { icon: Wallet, label: 'Expense', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  po: { icon: ShoppingCart, label: 'PO', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
};

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
 * QMRL Context Panel
 *
 * Shows parent QMRL details during QMHQ creation workflow.
 * Features:
 * - Responsive layout: visible on desktop, slide-in drawer on mobile
 * - Displays QMRL core info, description, department, contact
 * - Shows existing QMHQ count and list
 * - Attachment thumbnails with preview modal
 */
export function QmrlContextPanel({ qmrlId }: QmrlContextPanelProps) {
  // Data state
  const [qmrl, setQmrl] = useState<QMRLWithRelations | null>(null);
  const [relatedQmhq, setRelatedQmhq] = useState<QMHQRelated[]>([]);
  const [attachments, setAttachments] = useState<FileAttachmentWithUploader[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // UI state
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState<FileAttachmentWithUploader | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  /**
   * Load thumbnail URLs for image files
   */
  const loadThumbnails = useCallback(async (files: FileAttachmentWithUploader[]) => {
    const newUrls = new Map<string, string>();

    for (const file of files) {
      if (file.mime_type.startsWith('image/')) {
        const result = await getFileUrl(file.storage_path);
        if (result.success) {
          newUrls.set(file.id, result.data);
        }
      }
    }

    setThumbnailUrls(newUrls);
  }, []);

  /**
   * Fetch QMRL data with relations
   */
  useEffect(() => {
    if (!qmrlId) {
      setQmrl(null);
      setRelatedQmhq([]);
      setAttachments([]);
      setThumbnailUrls(new Map());
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch QMRL with relations
      const { data: qmrlData } = await supabase
        .from('qmrl')
        .select(`
          *,
          status:status_config(*),
          category:categories(*),
          department:departments(*),
          contact_person:contact_persons(*)
        `)
        .eq('id', qmrlId)
        .single();

      if (qmrlData) {
        setQmrl(qmrlData as QMRLWithRelations);
      }

      // Fetch related QMHQ
      const { data: qmhqData } = await supabase
        .from('qmhq')
        .select('id, request_id, line_name, route_type')
        .eq('qmrl_id', qmrlId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setRelatedQmhq((qmhqData as QMHQRelated[]) || []);

      // Fetch attachments
      const { data: filesData } = await supabase
        .from('file_attachments')
        .select('*, uploaded_by_user:users!uploaded_by(full_name, email)')
        .eq('entity_type', 'qmrl')
        .eq('entity_id', qmrlId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      const files = (filesData as FileAttachmentWithUploader[]) || [];
      setAttachments(files);
      await loadThumbnails(files);

      setIsLoading(false);
    };

    fetchData();
  }, [qmrlId, loadThumbnails]);

  /**
   * Handle attachment click - get signed URL and open preview
   */
  const handleAttachmentClick = useCallback(async (file: FileAttachmentWithUploader) => {
    setIsLoadingPreview(true);
    setPreviewFile(file);

    const result = await getFileUrl(file.storage_path);

    if (result.success) {
      setPreviewUrl(result.data);
    } else {
      setPreviewFile(null);
    }

    setIsLoadingPreview(false);
  }, []);

  /**
   * Close preview modal
   */
  const handlePreviewClose = useCallback(() => {
    setPreviewFile(null);
    setPreviewUrl(null);
  }, []);

  /**
   * Render preview content based on file type
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
          onError={handlePreviewClose}
        />
      );
    }

    if (isPdf) {
      return (
        <PDFPreview
          url={previewUrl}
          onError={handlePreviewClose}
          onPasswordRequired={handlePreviewClose}
          onDownload={() => window.open(previewUrl, '_blank')}
        />
      );
    }

    // Non-previewable files
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <FileIcon className="h-16 w-16 text-slate-500 mb-4" />
        <p className="text-slate-400 mb-2">Preview not available</p>
        <button
          onClick={() => previewUrl && window.open(previewUrl, '_blank')}
          className="text-amber-500 hover:text-amber-400 text-sm"
        >
          Download File
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Sticky Side Panel */}
      <div className="md:sticky md:top-4 md:self-start border border-slate-700 bg-slate-900 rounded-lg overflow-hidden flex flex-col md:max-h-[calc(100vh-2rem)]">
        {/* Panel Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2 p-4 border-b border-slate-700 bg-slate-900">
          <FileText className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold uppercase tracking-wider text-amber-500">
            QMRL Context
          </span>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!qmrlId ? (
            // No QMRL selected
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <FileText className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">Select a QMRL to see context</p>
            </div>
          ) : isLoading ? (
            // Loading state
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : qmrl ? (
            <>
              {/* QMRL ID Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 w-fit">
                <code className="text-sm font-mono text-amber-400">{qmrl.request_id}</code>
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-slate-200 leading-tight">
                {qmrl.title}
              </h3>

              {/* Status, Category, Priority */}
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>Request Date: {formatDate(qmrl.request_date)}</span>
              </div>

              {/* Description (truncated) */}
              {qmrl.description && (
                <div className="space-y-1">
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

              {/* Notes (truncated) */}
              {qmrl.notes && (
                <div className="space-y-1">
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
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
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

              {/* Existing QMHQ Lines */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Existing QMHQ Lines
                    </span>
                  </div>
                  <span className="text-lg font-mono font-bold text-amber-400">
                    {relatedQmhq.length}
                  </span>
                </div>
                {relatedQmhq.length > 0 && (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {relatedQmhq.map((qmhq) => {
                      const RouteIcon = routeConfig[qmhq.route_type]?.icon || Package;
                      const routeColors = routeConfig[qmhq.route_type];
                      return (
                        <div
                          key={qmhq.id}
                          className="flex items-center gap-2 p-2 rounded bg-slate-900/50 border border-slate-700/50"
                        >
                          <div className={cn(
                            'w-6 h-6 rounded flex items-center justify-center border',
                            routeColors?.bgColor
                          )}>
                            <RouteIcon className={cn('h-3 w-3', routeColors?.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 truncate">{qmhq.line_name}</p>
                            <code className="text-[10px] text-slate-500">{qmhq.request_id}</code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {relatedQmhq.length === 0 && (
                  <p className="text-xs text-slate-500 italic">No lines created yet</p>
                )}
              </div>

              {/* Attachments */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
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
                        onClick={() => handleAttachmentClick(file)}
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
            </>
          ) : (
            // QMRL not found
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
              <p className="text-sm text-slate-400">QMRL not found</p>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={handlePreviewClose}
        file={previewFile}
        fileUrl={previewUrl}
      >
        {renderPreviewContent()}
      </FilePreviewModal>
    </>
  );
}
