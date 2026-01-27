# Phase 3: File Upload UI - Research

**Researched:** 2026-01-28
**Domain:** React file upload components with drag-drop, thumbnails, and progress indicators
**Confidence:** HIGH

## Summary

This phase implements a file upload UI for attaching files to QMRL and QMHQ detail pages. The research focused on react-dropzone for drag-drop handling, thumbnail generation patterns with proper memory management, multi-file upload progress tracking, and integration patterns with the existing codebase.

The existing Phase 2 infrastructure provides server actions (`uploadFile`, `deleteFile`, `getFilesByEntity`) and validation utilities (`validateFile`, `formatFileSize`, `ALLOWED_EXTENSIONS`) that this UI will consume. The codebase already uses Radix UI primitives, Lucide icons, Tailwind CSS with a dark slate theme, and toast notifications - all of which will be leveraged.

**Primary recommendation:** Use react-dropzone's `useDropzone` hook with custom styling matching the existing slate/amber theme. Implement thumbnail previews with `URL.createObjectURL()` with proper cleanup via `URL.revokeObjectURL()`. Use a centralized upload state machine for multi-file uploads with retry logic.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-dropzone | ^14.x | Drag-drop file handling | De facto standard for React file uploads, provides useDropzone hook, full TypeScript support, handles browser quirks |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Delete confirmation | Already in project for modals |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Context menus | Already in project for file card actions |
| lucide-react | ^0.447.0 | Icons | Upload, file type, delete icons |
| class-variance-authority | ^0.7.1 | Style variants | File card states (uploading, error, success) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dropzone | Native drag events | More code, browser quirks to handle manually |
| react-dropzone | Uppy | Full-featured but overkill for our needs, adds ~60KB |
| URL.createObjectURL | FileReader | createObjectURL is faster for large files, just needs cleanup |

**Installation:**
```bash
npm install react-dropzone
```

Note: react-dropzone 14.x supports React 18. If upgrading to React 19 in the future, use `npm install --legacy-peer-deps`.

## Architecture Patterns

### Recommended Project Structure
```
components/
  files/
    file-dropzone.tsx       # Drop zone with useDropzone hook
    file-card.tsx           # Individual file display card
    file-grid.tsx           # Grid layout for file cards
    file-upload-progress.tsx # Overall progress indicator
    attachments-tab.tsx     # Complete tab for detail pages (orchestrator)
    delete-file-dialog.tsx  # Confirmation dialog for deletion
lib/
  hooks/
    use-file-upload.ts      # Custom hook for upload state management
```

### Pattern 1: useDropzone Hook Integration
**What:** Configure react-dropzone with our validation and file type restrictions
**When to use:** In the file-dropzone component
**Example:**
```typescript
// Source: react-dropzone documentation + project patterns
import { useDropzone, FileRejection } from 'react-dropzone';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, EXTENSION_MIME_MAP } from '@/lib/utils/file-validation';

// Build accept object from our extension list
const acceptMimeTypes = Object.entries(EXTENSION_MIME_MAP).reduce((acc, [ext, mime]) => {
  if (!acc[mime]) acc[mime] = [];
  acc[mime].push(ext);
  return acc;
}, {} as Record<string, string[]>);

function FileDropzone({ onFilesAccepted, disabled }: Props) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    accept: acceptMimeTypes,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        // Show toast with rejection reasons
      }
      if (acceptedFiles.length > 0) {
        onFilesAccepted(acceptedFiles);
      }
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "h-[180px] border-2 border-dashed rounded-lg transition-colors",
        isDragActive && !isDragReject && "border-amber-500 bg-amber-500/10",
        isDragReject && "border-red-500 bg-red-500/10",
        !isDragActive && "border-slate-700 bg-slate-800/30 hover:border-slate-600"
      )}
    >
      <input {...getInputProps()} />
      {/* Content */}
    </div>
  );
}
```

### Pattern 2: Thumbnail Preview with Memory Management
**What:** Generate image thumbnails with proper cleanup to prevent memory leaks
**When to use:** For image file cards during and after upload
**Example:**
```typescript
// Source: React best practices for blob URLs
import { useState, useEffect } from 'react';

function useImagePreview(file: File | null) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Cleanup: revoke URL when component unmounts or file changes
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return previewUrl;
}
```

### Pattern 3: Multi-File Upload State Machine
**What:** Centralized state management for batch uploads with retry logic
**When to use:** In the custom useFileUpload hook
**Example:**
```typescript
// Source: Project patterns + upload best practices
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface FileUploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number; // 0-100
  error?: string;
  retryCount: number;
  result?: FileAttachment;
}

interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  isUploading: boolean;
}

function useFileUpload(entityType: 'qmrl' | 'qmhq', entityId: string) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [abortControllers] = useState<Map<string, AbortController>>(new Map());

  const uploadFiles = async (files: File[]) => {
    const newItems = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      state: 'idle' as UploadState,
      progress: 0,
      retryCount: 0,
    }));

    setItems(prev => [...prev, ...newItems]);

    // Process sequentially to avoid overwhelming the server
    for (const item of newItems) {
      await uploadWithRetry(item);
    }
  };

  const uploadWithRetry = async (item: FileUploadItem, maxRetries = 3) => {
    // Implementation with exponential backoff
  };

  const cancel = () => {
    abortControllers.forEach(controller => controller.abort());
  };

  return { items, uploadFiles, cancel, progress };
}
```

### Pattern 4: Extension Badge Colors
**What:** Colored badges for non-image file types
**When to use:** File cards displaying non-image files (PDF, DOCX, etc.)
**Example:**
```typescript
// Source: Project patterns + design decisions from CONTEXT.md
const EXTENSION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '.pdf': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  '.doc': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  '.docx': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  '.xls': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  '.xlsx': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  '.ppt': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  '.pptx': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  // Images use thumbnail preview, not badge
};
```

### Anti-Patterns to Avoid
- **Creating blob URLs without cleanup:** Always pair `URL.createObjectURL()` with `URL.revokeObjectURL()` in useEffect cleanup
- **Parallel uploads without throttling:** Can overwhelm server and browser; process sequentially or with concurrency limit
- **Direct file mutation:** Never modify File objects; create new state objects instead
- **Missing drag feedback:** Always provide visual feedback for drag states (active, reject, accept)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-drop handling | Custom drag event handlers | react-dropzone | Browser quirks, edge cases, accessibility |
| File type validation from MIME | MIME detection logic | Extension-based (per Phase 2 decision) | MIME detection is complex and unreliable |
| Image thumbnails | Canvas-based resizing | URL.createObjectURL | Browser handles efficiently, just needs cleanup |
| Progress tracking | Custom XHR with onprogress | Server action completion tracking | Supabase SDK doesn't expose upload progress; track completion instead |

**Key insight:** react-dropzone handles all the browser drag-drop edge cases (directory drops, nested drag events, touch devices) that would take significant effort to handle correctly with custom code.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Blob URLs
**What goes wrong:** Browser accumulates memory from unreleased blob URLs
**Why it happens:** URL.createObjectURL creates URLs that persist until explicitly revoked
**How to avoid:** Always use useEffect cleanup to call URL.revokeObjectURL
**Warning signs:** Browser tab memory growing over time, especially with many file selections

### Pitfall 2: Upload Progress Not Visible
**What goes wrong:** Users don't know if uploads are happening or stuck
**Why it happens:** Server actions don't provide progress events; only completion
**How to avoid:** Show "X of Y files uploaded" counter; indicate processing state
**Warning signs:** No UI feedback during multi-file uploads

### Pitfall 3: Form Abandonment During Upload
**What goes wrong:** User navigates away, uploads left incomplete
**Why it happens:** No warning when uploads in progress
**How to avoid:** Use beforeunload event and in-app navigation warning
**Warning signs:** Orphaned partial uploads, confused users

### Pitfall 4: Accept Prop Misconfiguration
**What goes wrong:** react-dropzone doesn't filter correctly
**Why it happens:** Wildcards (image/*) with specific extensions don't work as expected
**How to avoid:** Use specific MIME types with their extensions: `{ 'image/jpeg': ['.jpg', '.jpeg'] }`
**Warning signs:** Files not being filtered during drag, wrong files accepted

### Pitfall 5: AbortController with StrictMode
**What goes wrong:** AbortController aborts immediately in development
**Why it happens:** React StrictMode double-renders components
**How to avoid:** Initialize AbortController inside useEffect, not component body
**Warning signs:** All uploads abort immediately in development mode

## Code Examples

Verified patterns from official sources and project patterns:

### Drop Zone Component Structure
```typescript
// Source: react-dropzone docs + project patterns
"use client";

import { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
  getAllowedTypesDisplay
} from '@/lib/utils/file-validation';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({ onFilesAccepted, disabled, className }: FileDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Handle rejections
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) =>
        `${file.name}: ${errors.map(e => e.message).join(', ')}`
      );
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
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "h-[180px] border-2 border-dashed rounded-lg transition-all cursor-pointer",
        "flex flex-col items-center justify-center gap-2",
        isDragActive && !isDragReject && "border-amber-500 bg-amber-500/10",
        isDragReject && "border-red-500 bg-red-500/10",
        !isDragActive && "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50",
        disabled && "opacity-50 cursor-not-allowed",
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
          <p className="text-sm text-slate-300">Drag files here or click to browse</p>
          <p className="text-xs text-slate-400">
            Accepted: {getAllowedTypesDisplay()}. Max {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </>
      )}
    </div>
  );
}
```

### File Card with Thumbnail
```typescript
// Source: Project patterns + memory management best practices
"use client";

import { useState, useEffect } from 'react';
import { MoreVertical, Trash2, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatFileSize, getFileExtension } from '@/lib/utils/file-validation';
import type { FileAttachment } from '@/types/database';

interface FileCardProps {
  file: FileAttachment & { uploaded_by_user?: { full_name: string } | null };
  thumbnailUrl?: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

const EXTENSION_COLORS: Record<string, { bg: string; text: string }> = {
  '.pdf': { bg: 'bg-red-500/20', text: 'text-red-400' },
  '.doc': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '.docx': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '.xls': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  '.xlsx': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  '.ppt': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  '.pptx': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

export function FileCard({ file, thumbnailUrl, onDelete, canDelete }: FileCardProps) {
  const extension = getFileExtension(file.filename);
  const isImage = file.mime_type.startsWith('image/');
  const colors = EXTENSION_COLORS[extension] || { bg: 'bg-slate-500/20', text: 'text-slate-400' };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="group relative rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden hover:border-slate-600 transition-colors">
      {/* Thumbnail / Extension Badge Area */}
      <div className="h-24 flex items-center justify-center bg-slate-900/50">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.filename}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center", colors.bg)}>
            <span className={cn("text-2xl font-bold uppercase", colors.text)}>
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
      {canDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded bg-slate-800/80 hover:bg-slate-700">
                <MoreVertical className="h-4 w-4 text-slate-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-400 focus:text-red-400"
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
```

### Upload Progress Indicator
```typescript
// Source: Project patterns + CONTEXT.md decisions
"use client";

import { Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadProgressProps {
  completed: number;
  total: number;
  failed: number;
  onCancel?: () => void;
}

export function UploadProgress({ completed, total, failed, onCancel }: UploadProgressProps) {
  const isComplete = completed + failed >= total;
  const hasErrors = failed > 0;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg border",
      isComplete && !hasErrors && "bg-emerald-500/10 border-emerald-500/30",
      isComplete && hasErrors && "bg-amber-500/10 border-amber-500/30",
      !isComplete && "bg-slate-800/50 border-slate-700"
    )}>
      {!isComplete ? (
        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
      ) : hasErrors ? (
        <AlertCircle className="h-5 w-5 text-amber-400" />
      ) : (
        <CheckCircle className="h-5 w-5 text-emerald-400" />
      )}

      <div className="flex-1">
        <p className="text-sm text-slate-200">
          {!isComplete
            ? `Uploading ${completed + 1} of ${total} files...`
            : hasErrors
              ? `${completed} uploaded, ${failed} failed`
              : `${completed} files uploaded successfully`
          }
        </p>
      </div>

      {!isComplete && onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-dropzone render props | useDropzone hook | v10 (2019) | Simpler API, better TypeScript support |
| FileReader for previews | URL.createObjectURL | Long established | Faster, more efficient for large files |
| Per-file progress bars | Batch completion tracking | N/A (server actions) | Supabase SDK doesn't expose progress; track completions |

**Deprecated/outdated:**
- `@types/react-dropzone`: Types are now bundled with react-dropzone itself; remove @types package if present
- `useFsAccessApi: true` option: Not needed for our use case (basic file selection)

## Open Questions

Things that couldn't be fully resolved:

1. **Thumbnail signed URLs for stored images**
   - What we know: getFileUrl() creates 1-hour signed URLs
   - What's unclear: Should we cache URLs? Refresh on tab focus?
   - Recommendation: For Phase 3, just fetch URL when tab loads. Phase 4 can optimize.

2. **Soft limit enforcement at 20 files**
   - What we know: CONTEXT.md says "warn but allow more"
   - What's unclear: Exact UX for the warning
   - Recommendation: Show toast warning when file count reaches 20; allow user to continue

## Sources

### Primary (HIGH confidence)
- [react-dropzone official documentation](https://react-dropzone.js.org/) - useDropzone API, accept configuration
- [react-dropzone GitHub](https://github.com/react-dropzone/react-dropzone) - examples, TypeScript types
- Existing codebase patterns - `/components/ui/*`, `/lib/actions/files.ts`
- CONTEXT.md decisions - drop zone design, file card layout, upload behavior

### Secondary (MEDIUM confidence)
- [Jacobparis - Thumbnails for file input images](https://www.jacobparis.com/content/file-image-thumbnails) - memory management patterns
- [React-Dropzone issues #398](https://github.com/react-dropzone/react-dropzone/issues/398) - memory leak prevention
- WebSearch results - upload retry patterns, accessibility best practices

### Tertiary (LOW confidence)
- WebSearch on "React file upload 2026" - general ecosystem overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-dropzone is well-documented, stable, and widely used
- Architecture: HIGH - patterns derived from official docs and existing codebase
- Pitfalls: MEDIUM - based on community reports and documentation warnings
- Code examples: HIGH - verified against official documentation and project patterns

**Research date:** 2026-01-28
**Valid until:** 60 days (react-dropzone is stable; patterns are established)
