# Phase 18: QMRL Create Attachments - Research

**Researched:** 2026-02-06
**Domain:** File upload during entity creation (React forms with deferred storage linking)
**Confidence:** HIGH

## Summary

This phase implements file upload functionality during QMRL creation, which requires handling files before the QMRL entity exists in the database. The key challenge is that the existing `uploadFile` server action requires an `entityId` to generate storage paths and create `file_attachments` records, but this ID only exists after the QMRL is created.

Research identified two architectural approaches: (1) **Upload-After-Create** pattern where files are held in client state during form filling and uploaded sequentially after QMRL creation succeeds, or (2) **Temporary-Path-Relink** pattern where files are uploaded to a temporary path then re-linked when the entity is created. The first pattern is simpler, leverages existing infrastructure, and aligns with the "graceful degradation" success criteria.

The existing codebase already has all required components: `react-dropzone` for drag-drop, `useFileUpload` hook for sequential upload with retry, and the `uploadFile` server action. The implementation primarily requires a new `FileDropzonePreview` component that holds files in state and a modified QMRL create flow that uploads after entity creation.

**Primary recommendation:** Use the Upload-After-Create pattern with a modified `useFileUploadDeferred` hook. Hold selected files in React state during form editing, upload sequentially after QMRL creation succeeds, and treat upload failures as non-blocking (graceful degradation).

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-dropzone | ^14.x | Drag-drop file handling | Already used in existing file upload UI |
| Next.js Server Actions | 14.x | File upload to Supabase | Already implements `uploadFile` with retry |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.x | Confirmation dialogs | If showing upload progress modal |
| lucide-react | ^0.447.x | Icons | Upload icons, file type icons |
| Tailwind CSS | 3.x | Styling | Match existing slate/amber theme |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Upload-After-Create | Temp-Path-Relink | More complex, requires storage path updates, migration concerns |
| Sequential upload | Parallel upload | Could overwhelm server; sequential is safer and proven |
| Client-side state | IndexedDB | Unnecessary complexity for typical file counts |

**Installation:**
```bash
# No new dependencies required - all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
components/
  files/
    file-dropzone.tsx             # Existing - reuse as-is
    file-dropzone-preview.tsx     # NEW - holds files in state with preview
    attachments-tab.tsx           # Existing - for detail pages
lib/
  hooks/
    use-file-upload.ts            # Existing - for detail page uploads
    use-file-upload-deferred.ts   # NEW - for create form uploads
app/
  (dashboard)/
    qmrl/
      new/
        page.tsx                  # MODIFY - add file section
```

### Pattern 1: Upload-After-Create (RECOMMENDED)
**What:** Hold files in client state during form editing, upload after entity creation succeeds
**When to use:** When entity must exist before files can be properly linked
**Example:**
```typescript
// Source: Project patterns + react-dropzone best practices

// 1. Hold files in state during form editing
const [pendingFiles, setPendingFiles] = useState<File[]>([]);

// 2. Handle form submission
const handleSubmit = async (formData) => {
  // Create QMRL first
  const { data: qmrl, error } = await supabase
    .from('qmrl')
    .insert(formData)
    .select()
    .single();

  if (error) {
    // Show error, don't upload files
    return;
  }

  // QMRL created successfully, now upload files (non-blocking)
  if (pendingFiles.length > 0) {
    uploadFilesSequentially(pendingFiles, 'qmrl', qmrl.id);
  }

  // Navigate to detail page immediately (don't wait for uploads)
  router.push(`/qmrl/${qmrl.id}`);
};

// 3. Sequential upload with graceful degradation
const uploadFilesSequentially = async (files: File[], entityType: string, entityId: string) => {
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadFile(formData, entityType, entityId);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      // Continue with next file (graceful degradation)
    }
  }
};
```

### Pattern 2: File Preview in Create Form
**What:** Show selected files with preview and remove option before form submission
**When to use:** In create forms where files are staged before upload
**Example:**
```typescript
// Source: react-dropzone patterns + existing project FileCard

interface StagedFile {
  id: string;          // Temporary client-side ID
  file: File;
  preview?: string;    // Blob URL for image preview
}

function FileDropzonePreview({
  files,
  onFilesChange
}: {
  files: StagedFile[];
  onFilesChange: (files: StagedFile[]) => void;
}) {
  const handleDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
    }));
    onFilesChange([...files, ...newFiles]);
  };

  const handleRemove = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview); // Clean up blob URL
    }
    onFilesChange(files.filter(f => f.id !== id));
  };

  // ... render dropzone and file list
}
```

### Pattern 3: Graceful Degradation with User Feedback
**What:** QMRL creation succeeds even if some file uploads fail; user notified of partial success
**When to use:** When file uploads are secondary to entity creation
**Example:**
```typescript
// Source: Success criteria requirement + UX best practices

// In the QMRL detail page (where user lands after creation)
useEffect(() => {
  // Check URL params or session storage for pending upload status
  const pendingUploads = sessionStorage.getItem(`pending-uploads-${qmrlId}`);
  if (pendingUploads) {
    const { completed, failed, total } = JSON.parse(pendingUploads);
    sessionStorage.removeItem(`pending-uploads-${qmrlId}`);

    if (failed > 0) {
      toast({
        title: 'Some files failed to upload',
        description: `${completed} of ${total} files uploaded. You can retry from the Attachments tab.`,
        variant: 'warning',
      });
    } else if (completed > 0) {
      toast({
        title: 'Files uploaded',
        description: `${completed} file${completed !== 1 ? 's' : ''} attached successfully.`,
      });
    }
  }
}, [qmrlId]);
```

### Anti-Patterns to Avoid
- **Blocking navigation on file upload:** QMRL creation is the primary action; uploads are secondary. Don't block user after entity is created.
- **Uploading to temp path then re-linking:** Requires storage move/copy operations and database updates; adds complexity without significant benefit.
- **Parallel uploads during form submit:** Can overwhelm server and cause race conditions; use sequential upload.
- **Forgetting blob URL cleanup:** Always revoke object URLs in cleanup functions to prevent memory leaks.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-drop handling | Custom drag events | react-dropzone (existing) | Browser quirks, accessibility |
| Upload retry logic | Custom retry | useFileUpload hook (existing) | Exponential backoff already implemented |
| File validation | Custom checks | file-validation.ts (existing) | Extension/size validation already done |
| Image previews | Canvas-based | URL.createObjectURL | Browser handles efficiently |
| Upload progress | Custom tracking | useFileUpload progress state | Already tracks completed/failed/total |

**Key insight:** The existing upload infrastructure handles all the hard parts. This phase is primarily about orchestrating the timing (upload after create) and adding a preview UI component.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Blob URLs
**What goes wrong:** Blob URLs created for image previews accumulate in memory
**Why it happens:** URL.createObjectURL creates URLs that persist until explicitly revoked
**How to avoid:** Use useEffect cleanup to revoke URLs when files are removed or component unmounts
**Warning signs:** Browser tab memory growing over time, especially with many file selections

### Pitfall 2: Files Lost on Navigation
**What goes wrong:** User selects files, navigates away, loses selection
**Why it happens:** Files held in React state are lost on unmount
**How to avoid:** Show confirmation dialog on navigation when files are pending; consider beforeunload handler
**Warning signs:** User reports selecting files but they "disappeared"

### Pitfall 3: Upload Failures Block Everything
**What goes wrong:** One file upload failure prevents QMRL creation or user from continuing
**Why it happens:** Upload logic throws/rejects without proper error handling
**How to avoid:** Always catch errors in upload loop; continue with next file; report failures to user
**Warning signs:** "Failed to upload" error blocks entire form submission

### Pitfall 4: Race Condition Between Create and Upload
**What goes wrong:** Upload starts before QMRL insert completes; entity_id doesn't exist
**Why it happens:** Async operations not properly awaited
**How to avoid:** Always `await` the QMRL insert before starting uploads; verify entity exists
**Warning signs:** Foreign key errors in file_attachments insert

### Pitfall 5: Large File Selection Freezes UI
**What goes wrong:** Selecting many large files causes UI to freeze
**Why it happens:** Creating blob URLs for many files synchronously
**How to avoid:** Only create previews for images; limit initial preview generation; use lazy loading
**Warning signs:** UI unresponsive after file selection

## Code Examples

Verified patterns from official sources and existing codebase:

### StagedFile Type Definition
```typescript
// Source: Pattern from existing FileUploadItem + preview needs

/**
 * Represents a file staged for upload but not yet submitted.
 * Used in create forms where files are selected before entity exists.
 */
export interface StagedFile {
  /** Temporary client-side ID for React key */
  id: string;
  /** The actual File object */
  file: File;
  /** Blob URL for image preview (undefined for non-images) */
  previewUrl?: string;
}
```

### useStagedFiles Hook
```typescript
// Source: React patterns + memory management best practices

import { useState, useCallback, useEffect } from 'react';

export function useStagedFiles() {
  const [files, setFiles] = useState<StagedFile[]>([]);

  // Add files with optional preview generation
  const addFiles = useCallback((newFiles: File[]) => {
    const staged: StagedFile[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
    }));
    setFiles(prev => [...prev, ...staged]);
  }, []);

  // Remove a file and clean up its preview URL
  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  // Clear all files and clean up preview URLs
  const clearFiles = useCallback(() => {
    files.forEach(f => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setFiles([]);
  }, [files]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, []); // Empty deps - only on unmount

  return { files, addFiles, removeFile, clearFiles };
}
```

### FileDropzonePreview Component
```typescript
// Source: Existing FileDropzone + FileCard patterns

'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
  getAllowedTypesDisplay,
  getFileExtension,
} from '@/lib/utils/file-validation';
import type { StagedFile } from '@/lib/hooks/use-staged-files';

interface FileDropzonePreviewProps {
  files: StagedFile[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (id: string) => void;
  disabled?: boolean;
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

export function FileDropzonePreview({
  files,
  onFilesAdd,
  onFileRemove,
  disabled,
}: FileDropzonePreviewProps) {
  // ... dropzone setup (same as existing FileDropzone)

  return (
    <div className="space-y-4">
      {/* Dropzone area */}
      <div {...getRootProps()} className={cn(/* ... */)}>
        <input {...getInputProps()} />
        {/* ... drag states */}
      </div>

      {/* Staged files preview */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {files.map(staged => {
            const ext = getFileExtension(staged.file.name);
            const colors = EXTENSION_COLORS[ext] || { bg: 'bg-slate-500/20', text: 'text-slate-400' };

            return (
              <div
                key={staged.id}
                className="relative rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
              >
                {/* Thumbnail / Extension Badge */}
                <div className="h-20 flex items-center justify-center bg-slate-900/50">
                  {staged.previewUrl ? (
                    <img
                      src={staged.previewUrl}
                      alt={staged.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={cn("w-full h-full flex items-center justify-center", colors.bg)}>
                      <span className={cn("text-lg font-bold uppercase", colors.text)}>
                        {ext.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="p-2">
                  <p className="text-xs text-slate-200 truncate" title={staged.file.name}>
                    {staged.file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(staged.file.size)}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onFileRemove(staged.id)}
                  className="absolute top-1 right-1 p-1 rounded bg-slate-800/80 hover:bg-red-500/80 transition-colors"
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
```

### Modified handleSubmit for QMRL Create
```typescript
// Source: Existing QMRL create page + upload patterns

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validate required fields
  if (!formData.title || !formData.contact_person_id) {
    toast({
      title: "Validation Error",
      description: "Please fill in all required fields.",
      variant: "destructive",
    });
    return;
  }

  setIsSubmitting(true);

  // Step 1: Create QMRL (primary action)
  const { data: qmrl, error } = await supabase
    .from('qmrl')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to create request.",
      variant: "destructive",
    });
    setIsSubmitting(false);
    return;
  }

  // Step 2: Upload staged files (secondary, non-blocking)
  if (stagedFiles.length > 0) {
    // Store upload intent for feedback on detail page
    sessionStorage.setItem(`pending-uploads-${qmrl.id}`, JSON.stringify({
      total: stagedFiles.length,
      completed: 0,
      failed: 0,
    }));

    // Start uploads (don't await - let them complete in background)
    uploadStagedFiles(stagedFiles, qmrl.id).then(({ completed, failed }) => {
      sessionStorage.setItem(`pending-uploads-${qmrl.id}`, JSON.stringify({
        total: stagedFiles.length,
        completed,
        failed,
      }));
    });
  }

  // Step 3: Navigate immediately (don't wait for uploads)
  toast({
    title: "Success",
    description: "Request letter created successfully.",
    variant: "success",
  });

  router.push(`/qmrl/${qmrl.id}`);
};

// Sequential upload helper
async function uploadStagedFiles(files: StagedFile[], entityId: string) {
  let completed = 0;
  let failed = 0;

  for (const staged of files) {
    try {
      const formData = new FormData();
      formData.append('file', staged.file);
      const result = await uploadFile(formData, 'qmrl', entityId);

      if (result.success) {
        completed++;
      } else {
        failed++;
        console.error(`Upload failed for ${staged.file.name}:`, result.error);
      }
    } catch (error) {
      failed++;
      console.error(`Upload error for ${staged.file.name}:`, error);
    }
  }

  return { completed, failed };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upload during form fill | Upload after entity create | N/A (design choice) | Cleaner error handling, entity always exists |
| Block on upload failure | Graceful degradation | N/A (UX requirement) | Better user experience |
| Custom blob management | URL.createObjectURL with cleanup | Long established | Memory-safe previews |

**Deprecated/outdated:**
- FileReader for previews: createObjectURL is faster and more efficient
- Parallel upload without throttling: Sequential with retry is more reliable

## Open Questions

Things that couldn't be fully resolved:

1. **Upload progress visibility after navigation**
   - What we know: User navigates to detail page while uploads continue
   - What's unclear: Should we show progress on detail page? Background toast?
   - Recommendation: Use sessionStorage to pass upload status; show toast on detail page load

2. **Maximum files in create form**
   - What we know: Detail page warns at 20 files
   - What's unclear: Should create form have lower limit since all uploaded at once?
   - Recommendation: Same 20-file soft limit; warn but allow more

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/components/files/file-dropzone.tsx`, `/lib/hooks/use-file-upload.ts`, `/lib/actions/files.ts`
- Existing codebase: `/app/(dashboard)/qmrl/new/page.tsx` (current create page)
- Phase 3 Research: `.planning/phases/03-file-upload-ui/03-RESEARCH.md`
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)

### Secondary (MEDIUM confidence)
- [React Dropzone documentation](https://react-dropzone.js.org/)
- [React Dropzone + React Hook Form patterns](https://www.esparkinfo.com/qanda/reactjs/react-dropzone-with-react-hook-form)
- [Dev.to - How to Use React-Dropzone](https://dev.to/nnnirajn/how-to-use-react-dropzone-for-uploading-files-hm2)

### Tertiary (LOW confidence)
- WebSearch results on "upload before entity creation" patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project and proven
- Architecture: HIGH - Upload-After-Create is simple, leverages existing code
- Pitfalls: HIGH - Well-documented React/blob URL memory management
- Code examples: HIGH - Based on existing codebase patterns

**Research date:** 2026-02-06
**Valid until:** 60 days (patterns are stable, no external dependency changes expected)
