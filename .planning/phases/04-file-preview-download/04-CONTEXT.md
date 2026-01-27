# Phase 4: File Preview & Download - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view attached files without leaving the application. Click any file to open a preview modal with image/PDF viewing or download fallback. Bulk download all files as a single ZIP archive.

</domain>

<decisions>
## Implementation Decisions

### Preview Modal Behavior
- Click anywhere on file card opens preview (entire card is clickable)
- One file at a time — no cycling between files, close and reopen for different file
- Close via: X button, click outside modal, or Escape key
- Sidebar panel for metadata (name, size, upload date, uploader) — collapsible with toggle, default visible
- Download button included in modal actions
- No delete action in modal — use file list for deletion
- Spinner/skeleton loading state while content loads
- Error handling: auto-close modal + toast notification if file fails to load
- For non-previewable files (.zip, .docx, etc.): show file icon + metadata + download only
- Sidebar state not persisted — always starts visible

### Image Preview
- Initial display: fit image to container
- Zoom controls: +/- buttons only (no scroll wheel zoom)
- Zoom levels: fixed set (50%, 100%, 150%, 200%)
- No reset/fit-to-window button — use zoom buttons to navigate
- Panning when zoomed: scroll bars appear
- Zoom level displayed as percentage (e.g., "150%")
- Checkerboard background for transparent images (PNG with alpha)

### PDF Viewer
- Standard viewer: page navigation + zoom (no search)
- Page navigation: Prev/Next buttons + page number input field
- No thumbnail sidebar — just page numbers
- Zoom: same as images (+/- buttons, 50%/100%/150%/200% levels)
- Page count displayed: "Page 3 of 12" format
- No keyboard shortcuts — buttons only
- Password-protected PDFs: show error message + offer download fallback
- Corrupted/failed PDFs: auto-close modal + toast (consistent with other errors)

### Download Behavior
- "Download All" button above file list (prominent placement)
- ZIP naming: entity-based (e.g., "QMRL-2025-00001-attachments.zip")
- Button always visible regardless of file count (even for single file)
- Progress indicator during ZIP generation
- ZIP generation location: Claude's discretion
- ZIP error: toast notification + suggest downloading files individually
- Individual downloads preserve original filename
- No download button on file cards — open preview first, download from there

### Claude's Discretion
- Modal size: large overlay vs full-screen toggle (pick based on content type)
- ZIP generation: server-side vs client-side (pick based on architecture)
- Exact spinner/skeleton design
- Zoom button placement and styling
- Error toast message wording

</decisions>

<specifics>
## Specific Ideas

- Consistency: same zoom controls and levels for both images and PDFs
- Checkerboard for transparency (like image editors)
- Entity-based ZIP naming makes downloads identifiable later

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-file-preview-download*
*Context gathered: 2026-01-28*
