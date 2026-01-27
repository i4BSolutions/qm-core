---
phase: 03-file-upload-ui
plan: 03
subsystem: ui
tags: [react, file-upload, attachments, qmhq, tabs]

# Dependency graph
requires:
  - phase: 03-02
    provides: AttachmentsTab component for file upload orchestration
  - phase: 03-01
    provides: File upload components (dropzone, card, grid, progress, delete dialog)
provides:
  - QMHQ detail page with Attachments tab
  - File upload capability on QMHQ entities
  - Unified file upload UI across both QMRL and QMHQ
affects: [future detail pages needing file attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Attachments tab pattern reused across entity types"
    - "File count badge in tab trigger with dynamic updates"

key-files:
  created: []
  modified:
    - app/(dashboard)/qmhq/[id]/page.tsx

key-decisions: []

patterns-established:
  - "Reusable AttachmentsTab component for any entity type"
  - "File count callback pattern keeps tab badge in sync"

# Metrics
duration: 16min
completed: 2026-01-27
---

# Phase 03 Plan 03: QMHQ File Upload Integration Summary

**QMHQ detail page with Attachments tab enabling drag-drop file uploads, matching QMRL functionality**

## Performance

- **Duration:** 16 min
- **Started:** 2026-01-27T18:59:09Z
- **Completed:** 2026-01-27T19:15:37Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added Attachments tab to QMHQ detail page with file count badge
- Integrated AttachmentsTab component with QMHQ entity
- Completed Phase 3 success criteria for both QMRL and QMHQ entities
- Unified file upload experience across both entity types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Attachments tab to QMHQ detail page** - `64538dc` (feat)
   - Imported Paperclip icon and AttachmentsTab component
   - Added fileCount state for tab badge
   - Fetch file count on data load from file_attachments table
   - Added Attachments tab trigger with file count badge
   - Added Attachments tab content with AttachmentsTab component
   - Pass onFileCountChange callback to keep badge synchronized

2. **Task 2: Verify complete integration** - (verification only, no commit)
   - Verified npm run build passes
   - Verified npm run type-check passes
   - Verified all Phase 3 file components exist
   - Verified import chain completeness

## Files Created/Modified
- `app/(dashboard)/qmhq/[id]/page.tsx` - Added Attachments tab with file upload capability, matching QMRL pattern

## Decisions Made
None - plan executed exactly as written. AttachmentsTab component from plan 03-02 was successfully reused.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Note on dependency timing:** Plan 03-02 (creating AttachmentsTab) and 03-03 (integrating it into QMHQ) were both marked as wave 2, but 03-03 has an implicit dependency on 03-02's output. The AttachmentsTab component was already created when this plan executed, enabling smooth integration.

No other issues encountered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 (File Upload UI) is now complete:
- ✅ User can drag-drop files onto QMRL detail page Attachments tab to upload
- ✅ User can drag-drop files onto QMHQ detail page Attachments tab to upload
- ✅ User sees list of uploaded files sorted by upload date with thumbnails
- ✅ Attachments tabs show file count badges
- ✅ User can delete files with confirmation dialog
- ✅ Upload progress indicators during file transfer
- ✅ Navigation warnings during active uploads

**Complete Phase 3 file structure:**
```
lib/
  hooks/use-file-upload.ts          ← Sequential upload with retry
  actions/files.ts                  ← Server actions for upload/delete/get
  utils/file-validation.ts          ← Extension/size validation
components/
  files/
    file-dropzone.tsx               ← Drag-drop zone
    file-card.tsx                   ← Individual file display
    file-grid.tsx                   ← Grid layout
    upload-progress.tsx             ← Progress indicator
    delete-file-dialog.tsx          ← Delete confirmation
    attachments-tab.tsx             ← Orchestrator component
app/(dashboard)/
  qmrl/[id]/page.tsx               ← Attachments tab added
  qmhq/[id]/page.tsx               ← Attachments tab added
```

**Ready for:** Any future entity types that need file attachment capability can reuse the AttachmentsTab component.

---
*Phase: 03-file-upload-ui*
*Completed: 2026-01-27*
