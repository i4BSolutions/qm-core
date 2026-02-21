---
phase: 63-qmhq-auto-status
plan: 01
subsystem: ui
tags: [qmhq, auto-status, lucide-react, tailwind, typescript]

# Dependency graph
requires:
  - phase: 58-v1.12
    provides: QMHQ module with route types (item/expense/po) and child records (SOR, transactions, POs)
provides:
  - QmhqAutoStatus type: 9 literals across item/expense/po × pending/processing/done
  - QMHQ_AUTO_STATUS_CONFIG: display config for all 9 auto status values
  - computeQmhqAutoStatus(): derives status from child record state per route type
  - getAutoStatusHexColor(): hex values for inline style contexts
  - AutoStatusBadge: client component rendering route type icon + label
affects:
  - 63-02 (QMHQ detail page integration — will consume AutoStatusBadge)
  - 64 (Dashboard — may surface auto status summaries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auto-status config object keyed by status literal type, parallel to PO_STATUS_CONFIG"
    - "Icon map pattern: { Package, Wallet, ShoppingCart } keyed by config.iconName for dynamic resolution"
    - "AutoStatusParams interface with optional route-specific fields; only relevant fields need values"

key-files:
  created:
    - lib/utils/qmhq-auto-status.ts
    - components/qmhq/auto-status-badge.tsx
  modified: []

key-decisions:
  - "iconName stored as string literal in config (not component ref) so config is JSON-serializable and icon map lookup is explicit"
  - "computeQmhqAutoStatus uses switch on routeType with exhaustive never check — TypeScript will catch missing RouteType cases"
  - "getAutoStatusHexColor uses ?? fallback (not ||) to avoid falsy-string issues"
  - "AutoStatusBadge defaults size to md; sm uses text-[11px] for sub-pixel precision matching design spec"

patterns-established:
  - "Auto status badge: inline-flex + gap-1.5 + px-2.5 py-1 rounded border — matches POStatusBadge structure"
  - "Color scheme across route types: Pending=amber-400/500, Processing=blue-400/500, Done=emerald-400/500"

requirements-completed:
  - AUTO-01
  - AUTO-02
  - AUTO-03
  - AUTO-04
  - AUTO-05
  - AUTO-06
  - AUTO-07
  - AUTO-08
  - AUTO-09

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 63 Plan 01: QMHQ Auto Status Utility and Badge Summary

**Nine-state QMHQ auto status system: computation utility (lib/utils/qmhq-auto-status.ts) and badge component (components/qmhq/auto-status-badge.tsx) covering item/expense/po routes with amber/blue/green Pending/Processing/Done color scheme**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T17:21:23Z
- **Completed:** 2026-02-21T17:23:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `lib/utils/qmhq-auto-status.ts` with QmhqAutoStatus type, QMHQ_AUTO_STATUS_CONFIG (9 entries), computeQmhqAutoStatus(), and getAutoStatusHexColor()
- Created `components/qmhq/auto-status-badge.tsx` as a client component rendering route-type icon + label with sm/md size support
- All 9 auto status states covered with correct priority logic (done > processing > pending) per route type

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auto status computation utility** - `c0546d7` (feat)
2. **Task 2: Create auto status badge component** - `4e5b2fd` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `lib/utils/qmhq-auto-status.ts` - QmhqAutoStatus type, QMHQ_AUTO_STATUS_CONFIG, computeQmhqAutoStatus(), getAutoStatusHexColor()
- `components/qmhq/auto-status-badge.tsx` - AutoStatusBadge client component with icon + label badge

## Decisions Made

- `iconName` stored as string literal in config (not component reference) so config remains JSON-serializable; icon is resolved at render time via explicit ICON_MAP lookup
- `computeQmhqAutoStatus` uses a `switch` on routeType with an exhaustive `never` check — TypeScript will surface any future RouteType additions that lack handling
- `getAutoStatusHexColor` uses `??` fallback to avoid false positives from empty string edge cases
- `AutoStatusBadge` defaults `size` to `"md"`; `"sm"` uses `text-[11px]` matching the spec exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/utils/qmhq-auto-status.ts` is ready to import anywhere: utility functions have no side effects
- `components/qmhq/auto-status-badge.tsx` is ready to mount on the QMHQ detail page (Plan 02)
- Both files pass `npm run type-check` with zero errors
- No blockers

---
*Phase: 63-qmhq-auto-status*
*Completed: 2026-02-21*
