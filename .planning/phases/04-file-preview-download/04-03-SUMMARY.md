---
phase: 04-file-preview-download
plan: 03
subsystem: ui
tags: [jszip, file-saver, zip-download, bulk-operations, attachments]

# Dependency graph
requires:
  - phase: 04-01
    provides: File preview modal foundation, getFileUrl server action
provides:
  - DownloadAllButton component with progress indicator
  - ZIP archive generation from all attachments
  - Entity-based ZIP naming (QMRL-YYYY-NNNNN-attachments.zip)
  - Partial failure handling with toast notifications
affects: []

# Tech tracking
tech-stack:
  added: [jszip, file-saver]
  patterns: [sequential-file-processing, progress-callback-pattern]

key-files:
  created:
    - components/files/download-all-button.tsx
  modified:
    - components/files/attachments-tab.tsx
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx

key-decisions:
  - "Sequential file fetching to avoid server overload"
  - "CDN-hosted pdfjs worker compatible with Next.js build"

patterns-established:
  - "Sequential processing: Process files one at a time when bulk operations could overwhelm server"
  - "Entity display ID props: Pass human-readable IDs for user-facing file naming"

# Metrics
duration: 28min
completed: 2026-01-27
---

# Phase 04 Plan 03: Download All as ZIP Summary

**JSZip-based bulk file download with progress indicator, entity-based ZIP naming, and graceful partial failure handling**

## Performance

- **Duration:** 28 min
- **Started:** 2026-01-27T21:50:35Z
- **Completed:** 2026-01-27T22:18:21Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Download All button component with JSZip integration
- Sequential file processing with progress percentage display
- Entity-based ZIP naming (QMRL-YYYY-NNNNN-attachments.zip, QMHQ-YYYY-NNNNN-attachments.zip)
- Partial/total failure handling with appropriate toast notifications
- Integration into both QMRL and QMHQ detail pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create download-all-button component** - `8d031d6` (feat)
2. **Task 2: Integrate download button into attachments tab** - `3c8c784` (feat)
3. **Task 3: Update QMRL and QMHQ pages** - `e65637c` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `components/files/download-all-button.tsx` - DownloadAllButton component (146 lines) with JSZip, progress, error handling
- `components/files/attachments-tab.tsx` - Added entityDisplayId prop and DownloadAllButton integration
- `app/(dashboard)/qmrl/[id]/page.tsx` - Pass request_id as entityDisplayId
- `app/(dashboard)/qmhq/[id]/page.tsx` - Pass request_id as entityDisplayId

## Decisions Made
- Sequential file fetching: Download files one at a time to avoid overwhelming the server (matches upload pattern from 03-01)
- Entity display ID prop: Added new required prop to AttachmentsTab for proper ZIP naming

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Build initially failed with pdfjs-dist worker error from parallel 04-02 execution. Issue was already resolved by 04-02 using CDN worker approach. No action required from this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (File Preview & Download) complete
- All preview and download functionality working for QMRL and QMHQ
- Ready for Phase 5 (Dashboard & Analytics)

---
*Phase: 04-file-preview-download*
*Completed: 2026-01-27*
