---
phase: 21-item-enhancements
plan: 02
subsystem: ui
tags: [react, tooltip, radix-ui, tanstack-table]

# Dependency graph
requires:
  - phase: 21-01
    provides: price_reference column and Tooltip component
provides:
  - Price reference input field in Item Dialog
  - Price reference column in Item List page
  - Code-first item display format (SKU - Name)
  - Tooltip with price reference in PO line item selector
affects: [PO creation, invoice line items]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Code-first display: SKU code shown prominently before item name"
    - "Tooltip on select items for auxiliary info display"

key-files:
  created: []
  modified:
    - app/(dashboard)/item/item-dialog.tsx
    - app/(dashboard)/item/page.tsx
    - components/po/po-line-items-table.tsx
    - app/(dashboard)/po/new/page.tsx

key-decisions:
  - "Price reference required for new items (marked with asterisk)"
  - "Category required only for new items, existing items can be edited without"
  - "Code-first format: SKU - Name for all item displays"
  - "Tooltip shows on hover with 300ms delay for price reference"

patterns-established:
  - "Code-first item display: SKU in amber monospace followed by dash and name"
  - "Required field conditional: only for new items (!item)"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 21 Plan 02: Item UI Enhancement Summary

**Price reference input field in Item Dialog, price reference column in Item List, code-first display format across all item selectors with tooltip**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-06T14:33:57Z
- **Completed:** 2026-02-06T14:37:46Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added price reference input with 100 char limit and character counter to Item Dialog
- Made category required for new items with red asterisk indicator
- Added Price Reference column to Item List with truncation and native tooltip
- Changed SKU column to "Code" with larger, bolder styling
- Updated PO line item selector with code-first format (SKU - Name) and price reference tooltip
- Updated readonly PO line items table to code-first format

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Item Dialog with price reference and required category** - `3ac61a2` (feat)
2. **Task 2: Update Item List page with price reference column and code-first display** - `25392c3` (feat)
3. **Task 3: Update PO line item selector with tooltip and code-first display** - `6250921` (feat)

## Files Created/Modified

- `app/(dashboard)/item/item-dialog.tsx` - Added price_reference field, required category for new items, prominent SKU display
- `app/(dashboard)/item/page.tsx` - Added price_reference to query and column, code-first SKU display
- `components/po/po-line-items-table.tsx` - Code-first display, tooltip for price reference
- `app/(dashboard)/po/new/page.tsx` - Updated items query and state type to include price_reference

## Decisions Made

- Price reference and category are required only for new items; existing items can be edited without them for backward compatibility
- Character counter shows "X/100 characters - helps purchasing team" for user guidance
- Native title attribute used for Item List truncation tooltip (simpler than Radix tooltip)
- Radix Tooltip used for PO selector (richer UX on hover during selection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated po/new/page.tsx to include price_reference**
- **Found during:** Task 3 (TypeScript type check)
- **Issue:** EditableLineItemsTableProps required price_reference but po/new/page.tsx wasn't fetching it
- **Fix:** Added price_reference to items query and updated state type
- **Files modified:** app/(dashboard)/po/new/page.tsx
- **Verification:** npm run type-check passes
- **Committed in:** 6250921 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for type safety. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Price reference field available for all item operations
- Code-first display pattern established for consistent item identification
- Plan 03 (WAC display) can proceed with item display foundation

---
*Phase: 21-item-enhancements*
*Completed: 2026-02-06*

## Self-Check: PASSED
