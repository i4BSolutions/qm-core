# Phase 3: File Upload UI - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can attach files to existing QMRL and QMHQ entities through a drag-drop interface on detail pages. File attachments are NOT available during entity creation — only on detail pages for already-created records.

</domain>

<decisions>
## Implementation Decisions

### Drop Zone Design
- Dedicated "Attachments" section at bottom of Attachments tab (not full-form drop)
- Medium height (~180px), keeps same size after files added
- Solid subtle border, background matches existing system patterns
- Full overlay appears when dragging files (semi-transparent with "Drop files here" text)
- Upload cloud icon with "Drag files here or click to browse" text (idle state)
- Prominent "Browse files" button inside drop zone as alternative to dragging
- Accepted file types and size limit shown below drop zone: "Accepted: PDF, images, docs. Max 25MB"
- On detail pages: drop zone appears in dedicated "Attachments" tab alongside Details, History tabs

### File List Display
- Grid of cards layout (4 cards per row, fixed)
- Each card shows: thumbnail preview, filename, file size, upload date, uploader name
- Non-image files (PDFs, docs): colored extension badge (solid color card with large extension text)
- Delete option via context menu (right-click or three-dot menu)
- Click on file card: no action in Phase 3 (preview/download deferred to Phase 4)
- Many files (10+): scroll within section (max height with internal scroll)
- File count indicator: badge on Attachments tab showing count

### Upload Behavior
- Multi-file upload supported (users can drag/select multiple files at once)
- Partial success: valid files upload, invalid ones show error in toast notification
- Overall progress indicator (e.g., "3 of 5 files") rather than per-file bars
- Validation errors appear as toast notifications listing rejected files
- Success message: toast notification "X files uploaded successfully"
- Soft limit warning at 20 files per entity (warn but allow more)
- Duplicate filename: warn but allow user to confirm and proceed
- Cancel button available during upload to abort remaining files
- Auto-retry failed uploads 3 times before giving up
- Keep successful uploads if batch partially fails

### Form Integration
- Files only on detail pages — NOT on create forms
- File deletion requires confirmation dialog
- Anyone with edit access to QMRL/QMHQ can delete its files
- Soft delete using existing 30-day grace period from Phase 2
- Attachments tab always visible with badge showing count (shows "(0)" when empty)
- Read-only users see file list but no drop zone (no upload capability)
- Navigation warning if uploads in progress: "You have uploads in progress. Leave anyway?" — warn but allow leaving

### Claude's Discretion
- Exact drop zone background color matching
- Loading skeleton design for file grid
- Specific toast notification styling and duration
- Progress indicator placement and animation
- Confirmation dialog design and wording

</decisions>

<specifics>
## Specific Ideas

- Colored extension badges for non-image files (like colored file type icons — PDF in red, DOC in blue, etc.)
- Context menu on file cards for actions (delete, eventually download/preview in Phase 4)
- Tab badge pattern similar to other tabs in the system

</specifics>

<deferred>
## Deferred Ideas

- File preview modal (clicking files) — Phase 4
- Download functionality — Phase 4
- ZIP download for multiple files — Phase 4
- File upload on create forms — not planned (entities must exist first)

</deferred>

---

*Phase: 03-file-upload-ui*
*Context gathered: 2026-01-27*
