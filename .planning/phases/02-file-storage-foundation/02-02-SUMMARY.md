---
phase: 02-file-storage-foundation
plan: 02
subsystem: application
tags: [file-validation, server-actions, typescript-types, supabase-storage]

# Dependency graph
requires:
  - phase: 02-file-storage-foundation
    plan: 01
    provides: file_attachments table, attachments storage bucket, RLS policies
provides:
  - file validation utilities (extension, size, path generation)
  - server actions for upload, delete, and retrieval
  - FileAttachment TypeScript types for type-safe operations
affects: [phase-3 ui-components, file-upload-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-actions-pattern, atomic-upload-with-rollback, soft-delete-pattern]

key-files:
  created:
    - lib/utils/file-validation.ts
    - lib/actions/files.ts
  modified:
    - types/database.ts
    - tsconfig.json

key-decisions:
  - "Extension-only validation (no MIME magic byte check) - matches 02-CONTEXT.md decision"
  - "Atomic upload pattern: upload to storage, create metadata, rollback on failure"
  - "Exclude supabase/functions from tsconfig - Deno Edge Functions have own TS config"

patterns-established:
  - "Server actions return { success: true, data } | { success: false, error }"
  - "File validation returns ValidationResult type for consistent error handling"
  - "Storage path format: {entityType}/{entityId}/{safeName}_{timestamp}.{ext}"

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 02 Plan 02: File Validation and Server Actions Summary

**File validation utilities and server actions for secure file uploads with atomic operations and TypeScript type safety**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T16:25:00Z
- **Completed:** 2026-01-27T16:33:00Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- File validation utilities with extension allowlist (images, PDF, Office) and 25MB size limit
- Storage path generation with timestamp collision prevention
- Server actions for uploadFile, deleteFile, getFilesByEntity, getFileUrl, getFileById
- Atomic upload pattern: storage upload + metadata insert with rollback on failure
- FileAttachment TypeScript types added to database.ts
- Build passes without errors after excluding Deno Edge Functions from tsconfig

## Task Commits

Each task was committed atomically:

1. **Task 1: Create file validation utilities** - `55e21fd` (feat)
2. **Task 2: Create file server actions** - `43ab26c` (feat)
3. **Task 3: Add FileAttachment type to database types** - `dd55e63` (feat)

## Files Created

- `lib/utils/file-validation.ts` - Validation utilities with ALLOWED_EXTENSIONS, MAX_FILE_SIZE, validateFile, generateStoragePath, getMimeType, formatFileSize
- `lib/actions/files.ts` - Server actions with full error handling and atomic operations

## Files Modified

- `types/database.ts` - Added file_attachments table type with Row/Insert/Update variants and FileAttachment export
- `tsconfig.json` - Excluded supabase/functions directory (Deno runtime uses different TS config)

## Decisions Made

1. **Extension-only validation** - Following the 02-CONTEXT.md decision to trust file extensions without MIME/magic byte verification. Simplifies validation while covering common attack vectors through extension allowlist.

2. **Atomic upload pattern** - Upload creates storage object first, then metadata record. If metadata insert fails, storage object is deleted. This prevents orphaned storage objects.

3. **Exclude Deno from tsconfig** - Supabase Edge Functions use Deno runtime with different module resolution (HTTP imports). Excluding from Next.js tsconfig prevents build failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deno Edge Functions causing build failure**

- **Found during:** Task 3 verification
- **Issue:** Next.js build was trying to type-check supabase/functions/cleanup-expired-files/index.ts which uses Deno-specific imports (https://deno.land/...)
- **Fix:** Added "supabase/functions" to tsconfig.json exclude array
- **Files modified:** tsconfig.json
- **Commit:** dd55e63

## Exports Summary

### lib/utils/file-validation.ts

```typescript
export const ALLOWED_EXTENSIONS: readonly string[]
export const MAX_FILE_SIZE: number  // 25MB
export const EXTENSION_MIME_MAP: Record<string, string>
export function getFileExtension(filename: string): string
export function validateFileExtension(filename: string): boolean
export function validateFileSize(sizeInBytes: number): boolean
export function validateFile(filename: string, sizeInBytes: number): ValidationResult
export function generateStoragePath(entityType: 'qmrl' | 'qmhq', entityId: string, filename: string): string
export function getMimeType(filename: string): string
export function formatFileSize(bytes: number): string
export function getAllowedTypesDisplay(): string
```

### lib/actions/files.ts

```typescript
export async function uploadFile(formData: FormData, entityType: 'qmrl' | 'qmhq', entityId: string): Promise<FileOperationResult<FileAttachment>>
export async function deleteFile(fileId: string): Promise<FileOperationResult<void>>
export async function getFilesByEntity(entityType: 'qmrl' | 'qmhq', entityId: string): Promise<FileOperationResult<FileAttachmentWithUploader[]>>
export async function getFileUrl(storagePath: string): Promise<FileOperationResult<string>>
export async function getFileById(fileId: string): Promise<FileOperationResult<FileAttachmentWithUploader>>
```

### types/database.ts

```typescript
export type FileAttachment = Tables<"file_attachments">
export type FileAttachmentInsert = TablesInsert<"file_attachments">
export type FileAttachmentUpdate = TablesUpdate<"file_attachments">
```

## Next Phase Readiness

- File validation utilities ready for client-side pre-validation in UI
- Server actions ready for form submissions and file management
- TypeScript types provide compile-time safety for file operations
- Ready for Phase 3: File Upload UI Components

---
*Phase: 02-file-storage-foundation*
*Completed: 2026-01-27*
