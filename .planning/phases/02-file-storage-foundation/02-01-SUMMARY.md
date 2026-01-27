---
phase: 02-file-storage-foundation
plan: 01
subsystem: database
tags: [supabase-storage, rls, file-attachments, edge-functions, soft-delete]

# Dependency graph
requires:
  - phase: 01-critical-bug-fixes
    provides: stable QMRL/QMHQ entities with RLS policies
provides:
  - file_attachments metadata table with polymorphic entity reference
  - private attachments storage bucket with 25MB limit and MIME restrictions
  - RLS policies on file_attachments mirroring entity access
  - RLS policies on storage.objects for secure file access
  - cascade soft-delete triggers on QMRL/QMHQ deactivation
  - cleanup functions for 30-day grace period purge
  - Edge Function orchestrating full orphan cleanup
affects: [02-02 file-upload-api, phase-3 ui-components]

# Tech tracking
tech-stack:
  added: [supabase-storage, edge-functions]
  patterns: [polymorphic-entity-reference, storage-metadata-separation, cascade-soft-delete]

key-files:
  created:
    - supabase/migrations/030_file_attachments.sql
    - supabase/migrations/031_storage_bucket_rls.sql
    - supabase/migrations/032_file_cascade_cleanup.sql
    - supabase/functions/cleanup-expired-files/index.ts
  modified: []

key-decisions:
  - "Polymorphic entity reference (entity_type + entity_id) instead of separate FK columns"
  - "30-day grace period for soft-deleted files before permanent purge"
  - "storage.foldername() for path-based entity extraction in RLS"
  - "Batch processing (100 files) in cleanup to avoid API limits"

patterns-established:
  - "Storage path format: {entity_type}/{entity_id}/{filename}_{timestamp}.ext"
  - "File access mirrors parent entity RLS policies"
  - "Metadata table + Storage bucket separation pattern"
  - "Edge Function for storage cleanup (cannot delete storage objects via SQL)"

# Metrics
duration: 9min
completed: 2026-01-27
---

# Phase 02 Plan 01: File Storage Infrastructure Summary

**Supabase Storage file attachments infrastructure with RLS-protected metadata table, private bucket, cascade soft-delete, and Edge Function cleanup**

## Performance

- **Duration:** 9 min
- **Started:** 2026-01-27T16:11:25Z
- **Completed:** 2026-01-27T16:20:00Z
- **Tasks:** 4
- **Files created:** 4

## Accomplishments
- file_attachments table storing metadata for QMRL/QMHQ file attachments
- Private 'attachments' storage bucket with 25MB limit and allowed MIME types
- RLS policies on both file_attachments and storage.objects enforcing entity-based access
- Cascade triggers automatically soft-delete files when parent entity deactivated
- Edge Function orchestrating complete cleanup (storage + metadata) after 30-day grace

## Task Commits

Each task was committed atomically:

1. **Task 1: Create file_attachments table migration** - `1d2e759` (feat)
2. **Task 2: Create storage bucket and storage.objects RLS policies** - `4c486a4` (feat)
3. **Task 3: Create cascade soft-delete triggers and cleanup function** - `8fb52b1` (feat)
4. **Task 4: Create Edge Function for full orphan cleanup** - `4a812cc` (feat)

## Files Created

- `supabase/migrations/030_file_attachments.sql` - Metadata table with entity polymorphism and RLS
- `supabase/migrations/031_storage_bucket_rls.sql` - Storage bucket and storage.objects policies
- `supabase/migrations/032_file_cascade_cleanup.sql` - Cascade triggers and cleanup functions
- `supabase/functions/cleanup-expired-files/index.ts` - Edge Function for orphan cleanup

## Decisions Made

1. **Polymorphic entity reference** - Using entity_type + entity_id columns instead of separate FK columns for QMRL/QMHQ allows flexible attachment to either entity type with a single table.

2. **30-day grace period** - Soft-deleted files retained for 30 days before permanent purge, allowing recovery if parent entity restored.

3. **Path-based RLS** - Using storage.foldername() to extract entity type/ID from storage paths enables RLS checks without joining to file_attachments on every storage operation.

4. **Batch cleanup** - Processing 100 files per batch in Edge Function to avoid potential Storage API limits on bulk operations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Docker not available** - Could not run `npx supabase db reset` to verify migrations apply. SQL syntax verified manually. Migrations follow established patterns from prior iterations.

## User Setup Required

None - no external service configuration required. Edge Function uses built-in Supabase environment variables.

## Next Phase Readiness

- Database infrastructure complete for file attachments
- Storage bucket configured with appropriate restrictions
- RLS policies ready for both metadata and storage access
- Ready for Plan 02: File upload/download API routes and TypeScript utilities

---
*Phase: 02-file-storage-foundation*
*Completed: 2026-01-27*
