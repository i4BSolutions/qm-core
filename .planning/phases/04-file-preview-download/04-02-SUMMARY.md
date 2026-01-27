---
phase: 04-file-preview-download
plan: 02
subsystem: ui
tags: [react-pdf, pdfjs, pdf-viewer, next-dynamic, file-preview]

# Dependency graph
requires:
  - phase: 04-file-preview-download-01
    provides: FilePreviewModal component, ImagePreview with zoom controls
provides:
  - PDF preview component with page navigation and zoom
  - Dynamic import pattern for react-pdf SSR compatibility
  - Password-protected PDF detection with download fallback
affects: [04-file-preview-download-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CDN worker loading for pdfjs-dist (Next.js build compatibility)
    - Dynamic import with ssr:false for heavy client-side libraries

key-files:
  created:
    - components/files/pdf-preview.tsx
  modified:
    - components/files/attachments-tab.tsx

key-decisions:
  - "CDN worker for pdfjs-dist: Using unpkg CDN instead of import.meta.url for Next.js build compatibility"
  - "Dynamic import required: react-pdf must be loaded with ssr:false to avoid SSR crashes"

patterns-established:
  - "PDF.js CDN worker: pdfjs.GlobalWorkerOptions.workerSrc = unpkg.com/pdfjs-dist@version"
  - "Heavy library dynamic import: next/dynamic with ssr:false and loading skeleton"

# Metrics
duration: 24min
completed: 2026-01-27
---

# Phase 4 Plan 02: PDF Preview Summary

**PDF viewer with page navigation, zoom controls, and CDN-based worker loading for Next.js compatibility**

## Performance

- **Duration:** 24 min
- **Started:** 2026-01-27T21:50:14Z
- **Completed:** 2026-01-27T22:13:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PDF preview component with page navigation (Prev/Next buttons + input field)
- Fixed zoom levels (50%, 100%, 150%, 200%) matching image preview
- Password-protected PDF detection with download fallback
- CDN-based PDF.js worker loading (compatible with Next.js production build)
- Dynamic import with loading skeleton for SSR compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PDF preview component with react-pdf** - `939ec3c` (feat)
2. **Task 2: Integrate PDF preview into attachments tab** - `8c6d319` (feat)

## Files Created/Modified
- `components/files/pdf-preview.tsx` - PDF viewer with page navigation, zoom, error handling (345 lines)
- `components/files/attachments-tab.tsx` - Added dynamic PDF import, PDF error handlers, preview content routing

## Decisions Made

1. **CDN worker for pdfjs-dist** - Using `unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs` instead of `import.meta.url` approach. Rationale: import.meta.url causes "cannot be used outside of module code" error during Next.js Terser minification.

2. **Dynamic import required** - PDFPreview must be imported with `ssr: false` to avoid PDF.js worker initialization crashes during SSR. Added loading skeleton component for better UX.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CDN worker loading for Next.js compatibility**
- **Found during:** Task 2 (Production build verification)
- **Issue:** Plan specified `import.meta.url` for worker, but this causes Terser error during Next.js build: "'import.meta' cannot be used outside of module code"
- **Fix:** Changed to CDN-based worker loading using unpkg.com with exact pdfjs-dist version from pdfjs.version
- **Files modified:** components/files/pdf-preview.tsx
- **Verification:** Production build succeeds, PDF preview works in browser
- **Committed in:** 8c6d319 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for production build. No scope creep.

## Issues Encountered

1. **Worker configuration incompatibility** - The plan specified using `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` for worker source. This works in development but fails during production build because Terser cannot handle import.meta in the minified output. Resolved by using CDN URL with version interpolation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PDF preview fully integrated and working
- All previewable file types now supported (images + PDFs)
- Ready for Plan 04-03: Download all as ZIP (may already be complete in parallel)

---
*Phase: 04-file-preview-download*
*Completed: 2026-01-27*
