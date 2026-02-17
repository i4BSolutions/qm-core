---
phase: 56-list-view-standardization
plan: 02
subsystem: ui
tags: [react, typescript, next.js, pagination, user-avatar, boring-avatars, filter-bar]

# Dependency graph
requires:
  - phase: 56-list-view-standardization-plan-01
    provides: usePaginationParams hook, QMRL reference implementation, UserAvatar component
provides:
  - QMHQ list page with assigned filter (avatar+name dropdown), avatar-only column with tooltip, URL pagination, toolbar toggle, responsive behavior
  - PO list page with assigned filter via QMHQ join, URL pagination, toolbar toggle, responsive behavior
  - Invoice list page with creator filter (avatar+name dropdown), URL pagination, toolbar toggle, responsive behavior
  - Items page rebuilt from DataTable to card/list toggle with FilterBar, card grid, list table (SKU, Name, Category, Unit, Price Ref), URL pagination
affects:
  - phase-57
  - any future list views in the codebase

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "usePaginationParams(20) for URL-driven pagination on all list pages"
    - "Filter change handlers call setCurrentPage(1) to reset page on filter change"
    - "Card/list toggle in FilterBar as last child with ml-auto (not in PageHeader.actions)"
    - "Responsive: useEffect checks window.innerWidth < 768 and auto-switches to card; desktop filters in hidden md:flex div, mobile in Popover"
    - "Assigned person filter: raw Shadcn Select with UserAvatar size 20 in dropdown options"
    - "List view assigned column: avatar-only (UserAvatar size 28) wrapped in Tooltip inside TooltipProvider"
    - "Status badges in list view: className text-xs text-white with backgroundColor style and border:none"
    - "All row/card clicks use router.push, not window.location.href"
    - "Items card view: relative positioned parent, absolute positioned dropdown to prevent propagation"

key-files:
  created: []
  modified:
    - app/(dashboard)/qmhq/page.tsx
    - app/(dashboard)/po/page.tsx
    - app/(dashboard)/invoice/page.tsx
    - app/(dashboard)/item/page.tsx

key-decisions:
  - "Invoice assigned filter uses created_by field (not assigned_to which doesn't exist on invoices)"
  - "PO assigned filter via QMHQ join: qmhq.assigned_to compared to assignedFilter (no column added to PO list view per LIST-03)"
  - "Items has no person association; no assigned filter added (no person field in data model)"
  - "Items default view is card (per research decision); card uses 3-col grid on lg"
  - "Items card keeps edit/delete dropdown via stopPropagation to prevent card click from firing"
  - "Items list view keeps Photo column for visual identification (satisfies LIST-05 and shows more)"

patterns-established:
  - "Standardization pattern: usePaginationParams + handleXChange(setCurrentPage(1)) + hidden md:flex filters + ml-auto toggle"
  - "Items rebuild: remove DataTable, add FilterBar, add viewMode state, build card+list manually"

requirements-completed:
  - LIST-02
  - LIST-03
  - LIST-04
  - LIST-05
  - PAGE-02

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 56 Plan 02: List View Standardization Summary

**QMHQ, PO, Invoice, and Items pages standardized with URL-driven pagination, assigned person filters (avatar+name), card/list toggle in FilterBar toolbar, router.push navigation, and responsive behavior — Items rebuilt from TanStack DataTable to manual card/list pattern**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-17T12:23:52Z
- **Completed:** 2026-02-17T12:32:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Standardized all 4 remaining list pages (QMHQ, PO, Invoice, Items) with the pattern established by Plan 01
- Added assigned person filter with UserAvatar+name dropdown to QMHQ and Invoice; PO filter via QMHQ join
- Rebuilt Items page from TanStack DataTable to manual card/list views with FilterBar and URL pagination
- All `window.location.href` calls replaced with `router.push` across all 4 pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Standardize QMHQ and PO pages** - `bf02754` (feat)
2. **Task 2: Standardize Invoice and Items pages** - `988b940` (feat)

**Plan metadata:** (created next)

## Files Created/Modified
- `app/(dashboard)/qmhq/page.tsx` - Added assigned filter, URL pagination, avatar column with tooltip, colored status badges, toolbar toggle, responsive behavior (750 lines)
- `app/(dashboard)/po/page.tsx` - Added assigned filter via QMHQ join, URL pagination, toolbar toggle, responsive behavior (669 lines)
- `app/(dashboard)/invoice/page.tsx` - Added creator filter, URL pagination, toolbar toggle, responsive behavior (693 lines)
- `app/(dashboard)/item/page.tsx` - Rebuilt from DataTable to card/list toggle with FilterBar, card grid, list table, URL pagination (662 lines)

## Decisions Made
- Invoice assigned filter uses `created_by` field since invoices have no `assigned_to` column
- PO assigned filter reads `po.qmhq?.assigned_to` via the extended QMHQ join; no Assigned Person column added to PO list view (LIST-03 does not require it)
- Items has no person association; assigned filter skipped per research (no person field in data model)
- Items default view is "card" (consistent with user decision from research phase)
- Items card view dropdown uses `e.stopPropagation()` to prevent card click when using edit/delete actions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 complete — all 4 pages standardized
- Phase 56 plan 03 (if exists) or next phase can proceed
- Pattern is fully established across all list pages in the system

## Self-Check: PASSED

- app/(dashboard)/qmhq/page.tsx: FOUND
- app/(dashboard)/po/page.tsx: FOUND
- app/(dashboard)/invoice/page.tsx: FOUND
- app/(dashboard)/item/page.tsx: FOUND
- .planning/phases/56-list-view-standardization/56-02-SUMMARY.md: FOUND
- Commit bf02754: FOUND
- Commit 988b940: FOUND

---
*Phase: 56-list-view-standardization*
*Completed: 2026-02-17*
