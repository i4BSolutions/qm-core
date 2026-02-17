---
phase: 56-list-view-standardization
plan: 03
subsystem: ui
tags: [react, next.js, pagination, filter, list-view, stock-out-requests, user-avatar]

# Dependency graph
requires:
  - phase: 56-01
    provides: usePaginationParams hook, QMRL list standardization pattern
  - phase: 56-02
    provides: QMHQ/PO/Invoice/Items list standardization pattern
provides:
  - Stock-out requests page with standardized FilterBar (status dropdown + requester filter with UserAvatar)
  - URL-driven pagination on stock-out requests page
  - LIST-06 columns in stock-out requests list view (SOR ID, Item, Requester, Reason, QMHQ Ref, Status)
  - Responsive auto-switch and mobile filter Popover on stock-out requests page
  - Cross-page consistency verification for all 6 list pages
affects: [future list pages, PAGE-01, PAGE-02, PAGE-03, LIST-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FilterBar with status dropdown + requester filter with UserAvatar — stock-out requests page
    - SOR_STATUS_COLORS map for solid-color status badges (colored background, white text)
    - paginatedRequests used for card view grouping (not filteredRequests)

key-files:
  created: []
  modified:
    - app/(dashboard)/inventory/stock-out-requests/page.tsx

key-decisions:
  - "Stock-out requests page uses status dropdown (not tabs) in FilterBar — consistent with other 5 list pages"
  - "Card view groups paginatedRequests (slice of filteredRequests), not all filteredRequests"

patterns-established:
  - "All 6 list pages now use: usePaginationParams + handleXChange(setCurrentPage(1)) + hidden md:flex desktop filters + ml-auto toggle + responsive Popover on mobile"
  - "SOR_STATUS_COLORS pattern for stock-out status badges: solid colored background, white text, no border"

requirements-completed:
  - LIST-06
  - PAGE-02

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 56 Plan 03: Stock-Out Requests List View Standardization Summary

**Stock-out requests page standardized with FilterBar (status + requester filters), URL-driven pagination, LIST-06 columns, router.push navigation, and responsive behavior — completing standardization across all 6 list pages**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T12:34:52Z
- **Completed:** 2026-02-17T12:40:53Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced status tabs and standalone search bar with standardized FilterBar (search, status dropdown, requester filter with UserAvatar, card/list toggle)
- Added URL-driven pagination via usePaginationParams(20) and Pagination component at page bottom
- Updated list view columns to match LIST-06: SOR ID, Item, Requester, Reason, QMHQ Ref, Status
- Replaced `window.location.href` with `router.push` for row navigation
- Added responsive auto-switch to card view below 768px and mobile filter Popover
- Cross-page verification confirmed all 6 list pages pass consistency checks: usePaginationParams, Pagination, router.push, FilterBar with toggle, responsive behavior

## Task Commits

1. **Task 1: Replace status tabs and search with standardized FilterBar, add URL pagination and requester filter** - `990f862` (feat)
2. **Task 2: Final cross-page verification and build check** - verification only, no file changes

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `app/(dashboard)/inventory/stock-out-requests/page.tsx` - Fully rewritten: FilterBar replaces status tabs, usePaginationParams, Pagination, requester filter with UserAvatar, LIST-06 columns, router.push, responsive behavior, SOR_STATUS_COLORS map

## Decisions Made

- Status filter implemented as raw Shadcn Select dropdown within FilterBar (consistent with QMRL, QMHQ pages), not as status tabs
- Card view groups `paginatedRequests` (the page slice), not the full `filteredRequests` — ensures card groups respect pagination boundary
- `SOR_STATUS_COLORS` Record maps stock-out status strings to hex colors for solid-color badges (white text, no border)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 list pages are fully standardized: QMRL (plan 01), QMHQ + PO + Invoice + Items (plan 02), stock-out requests (plan 03)
- Requirements LIST-01 through LIST-06, PAGE-01, PAGE-02, PAGE-03 satisfied across Phase 56
- Phase 57 (L2 approval UI) and Phase 58 (any remaining) can proceed independently

---
*Phase: 56-list-view-standardization*
*Completed: 2026-02-17*

## Self-Check: PASSED

- FOUND: `app/(dashboard)/inventory/stock-out-requests/page.tsx`
- FOUND: `.planning/phases/56-list-view-standardization/56-03-SUMMARY.md`
- FOUND: commit `990f862` (feat(56-03): standardize stock-out requests list page)
