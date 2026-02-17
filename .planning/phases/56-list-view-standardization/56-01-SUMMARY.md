---
phase: 56-list-view-standardization
plan: 01
subsystem: ui
tags: [react, next.js, pagination, url-params, list-view, responsive, user-avatar, tooltip, popover]

# Dependency graph
requires:
  - phase: 55-database-foundation-useravatar
    provides: UserAvatar component (boring-avatars Beam variant)

provides:
  - usePaginationParams hook: URL-driven pagination with ?page=N&pageSize=N
  - QMRL page with card/list toggle (default: card view)
  - QMRL list view table with 5 columns: ID, Title, Status, Assigned, Date
  - Responsive auto-switch to card view below 768px
  - Responsive filter collapse to Filters button on mobile
  - Assignee filter with avatar + name in dropdown

affects:
  - 56-02 (QMHQ list view — will import usePaginationParams from same hook)
  - 56-03 (PO/Invoice list views — same pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-driven pagination via usePaginationParams hook (reads/writes ?page=N&pageSize=N)"
    - "Card/list toggle stored in useState (no URL, no localStorage — per user decision)"
    - "Responsive filter collapse: hidden md:flex for desktop, md:hidden Popover for mobile"
    - "Assignee filter uses raw Select (not FilterBar.Select) to support JSX avatar children"
    - "List view status badges: colored background + white text via style prop"
    - "Assigned column: avatar-only with TooltipProvider wrapping table body"
    - "Filter change handlers call setCurrentPage(1) to reset URL page to 1"

key-files:
  created:
    - lib/hooks/use-pagination-params.ts
  modified:
    - lib/hooks/index.ts
    - app/(dashboard)/qmrl/page.tsx

key-decisions:
  - "usePaginationParams reads ?page and ?pageSize from URL; setPageSize resets to page 1"
  - "Assignee filter replaced with raw Shadcn Select (not FilterBar.Select) to support avatar JSX in options"
  - "Card/list toggle placed inside FilterBar as last child with ml-auto, per toolbar order decision"
  - "Toolbar order: Search | Assignee | Category | [toggle] (QMRL has no status filter dropdown)"
  - "Responsive: below 768px auto-switches to card view; filter dropdowns collapse to Popover button"
  - "Status badges in list view: colored background + white text (not outline variant)"
  - "Assigned column in list view: avatar-only (size=28) wrapped in Tooltip"

patterns-established:
  - "URL-driven pagination: import usePaginationParams from @/lib/hooks, destructure page/pageSize/setPage/setPageSize"
  - "Filter handlers always call setCurrentPage(1) before updating local state"
  - "Toggle inside FilterBar: ml-auto div with border/rounded-lg/overflow-hidden containing two icon buttons"
  - "Mobile filter collapse: hidden md:flex for desktop group, flex md:hidden for Popover trigger"
  - "List view table: command-panel > overflow-x-auto > table with thead/tbody pattern"
  - "Row clicks: onClick={() => router.push(...)} — NOT window.location.href"

requirements-completed:
  - LIST-01
  - PAGE-01
  - PAGE-03
  - AVTR-03

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 56 Plan 01: URL-Driven Pagination Hook + QMRL Reference List View

**URL-driven pagination hook (usePaginationParams) and QMRL page as the reference implementation for Phase 56's standardized card/list toggle, responsive filter collapse, and avatar-in-assignee-column pattern**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-17T12:16:05Z
- **Completed:** 2026-02-17T12:21:35Z
- **Tasks:** 2
- **Files modified:** 3 (1 created hook, 1 updated barrel, 1 rewritten page)

## Accomplishments

- Created `usePaginationParams` hook that reads/writes `?page=N&pageSize=N` URL params, enabling bookmarkable pagination and back-button navigation
- Rewrote QMRL page to use URL-driven pagination, replacing `useState` + `useEffect` reset pattern
- Added card/list toggle inside FilterBar (default: card view); list view has ID, Title, Status, Assigned Person (avatar + tooltip), Request Date columns
- Implemented responsive auto-switch (card below 768px) and filter collapse (Filters Popover button on mobile)
- Upgraded assignee filter from text-only FilterBar.Select to raw Select with avatar + name per option

## Task Commits

Each task was committed atomically:

1. **Task 1: Create usePaginationParams hook and export from barrel** - `de05d55` (feat)
2. **Task 2: Add list view, card/list toggle, URL pagination, and responsive behavior to QMRL page** - `42cfd86` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/hooks/use-pagination-params.ts` - New hook: reads ?page/?pageSize from URL, exposes setPage/setPageSize that push URL updates
- `lib/hooks/index.ts` - Added export for usePaginationParams
- `app/(dashboard)/qmrl/page.tsx` - Full rewrite: list view, card/list toggle, URL pagination, responsive behavior, avatar in assignee filter and column

## Decisions Made

- Assignee filter replaced with raw Shadcn `Select` instead of `FilterBar.Select` because `FilterBar.Select` only supports string labels — avatar JSX requires the raw component
- Card/list toggle placed inside `FilterBar` as last child with `ml-auto` to push it right, per the locked toolbar order decision from planning
- Toolbar order for QMRL (which has no status filter dropdown): Search | Assignee | Category | [toggle]
- Status badges in list view use colored background + white text (solid badge style), not the outline variant used in card view
- Assigned column in list view: avatar-only (size=28) wrapped in individual Tooltips, with `TooltipProvider` wrapping the whole table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript check passed on first attempt, build succeeded without errors.

## Self-Check: PASSED

- `lib/hooks/use-pagination-params.ts` - FOUND
- `lib/hooks/index.ts` - FOUND (exports usePaginationParams)
- `app/(dashboard)/qmrl/page.tsx` - FOUND (688 lines, above 300 min)
- Commit `de05d55` - FOUND
- Commit `42cfd86` - FOUND

## Next Phase Readiness

- `usePaginationParams` hook is ready for Plans 02 and 03 to import and reuse
- QMRL page is the reference implementation — Plans 02 and 03 replicate this pattern on QMHQ, PO, and Invoice pages
- All responsive patterns (auto-switch, filter collapse) are established and can be copied verbatim

---
*Phase: 56-list-view-standardization*
*Completed: 2026-02-17*
