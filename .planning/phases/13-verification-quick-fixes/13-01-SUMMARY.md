---
phase: 13-verification-quick-fixes
plan: 01
subsystem: ui
tags: [attachments, permissions, rls, files, qmrl, qmhq]

# Dependency graph
requires:
  - phase: 07-file-upload
    provides: AttachmentsTab component, FileCard component, deleteFile action
  - phase: 07.1-attachment-fixes
    provides: RLS policy for attachment delete (migration 037)
provides:
  - Per-file delete permission check in UI matching RLS policy
  - Users can delete their own file uploads
  - Admin/quartermaster retain full delete capability
affects: [file-management, attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-file permission callback pattern (canDeleteFile)
    - Ownership check matching RLS policy

key-files:
  created: []
  modified:
    - components/files/attachments-tab.tsx
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx

key-decisions:
  - "Per-file callback pattern vs single boolean - enables ownership checking per file"
  - "Ownership check matches RLS policy exactly (uploaded_by === user.id)"
  - "Deprecated canEdit prop but maintained backward compatibility"

patterns-established:
  - "canDeleteFile callback pattern: permission check per file based on ownership"
  - "canUpload separate from canDelete: upload always allowed, delete requires ownership or admin role"

# Metrics
duration: 12min
completed: 2026-02-02
---

# Phase 13 Plan 01: Attachment Delete Permission UI Fix Summary

**Per-file delete permission check matching RLS policy - users can delete their own uploads, admin/quartermaster can delete any file**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-02T00:00:00Z
- **Completed:** 2026-02-02T00:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- AttachmentsTab now accepts per-file permission callback (canDeleteFile)
- QMRL detail page checks file ownership for delete permission
- QMHQ detail page checks file ownership for delete permission
- Delete button visibility matches RLS policy behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Update AttachmentsTab to accept per-file permission function** - `6c2cd29` (feat)
2. **Task 2: Update QMRL and QMHQ detail pages with per-file permission check** - `bffeac7` (feat)

## Files Created/Modified
- `components/files/attachments-tab.tsx` - Added canDeleteFile callback prop and canUpload prop
- `app/(dashboard)/qmrl/[id]/page.tsx` - Implemented canDeleteFile callback matching RLS policy
- `app/(dashboard)/qmhq/[id]/page.tsx` - Implemented canDeleteFile callback matching RLS policy

## Decisions Made
- Used callback pattern (canDeleteFile) instead of boolean to enable per-file ownership checks
- Maintained backward compatibility with deprecated canEdit prop
- Separated upload capability (canUpload) from delete capability (canDeleteFile)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- npm dependencies not installed initially - resolved by running npm install
- File paths with brackets need quoting for git commands - used quoted paths

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Attachment delete permission fix complete
- UI now matches RLS policy behavior
- Ready for next plan in Phase 13

---
*Phase: 13-verification-quick-fixes*
*Plan: 01*
*Completed: 2026-02-02*
