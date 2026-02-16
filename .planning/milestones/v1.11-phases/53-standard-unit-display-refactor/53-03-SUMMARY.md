---
phase: 53-standard-unit-display-refactor
plan: 03
subsystem: ui
tags: [react, components, refactor, display, pdf]

# Dependency graph
requires:
  - phase: 53-01
    provides: StandardUnitDisplay refactored to presentational component

provides:
  - Warehouse, inventory, QMHQ, and stock-out displays using per-item standard unit names
  - Stock-out PDF with per-item unit names
  - Per-item standard_stock display on warehouse inventory rows
  - Zero references to useStandardUnitName hook system-wide

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [per-item-unit-display, direct-db-joins]

key-files:
  created: []
  modified:
    - app/(dashboard)/warehouse/[id]/page.tsx
    - app/(dashboard)/inventory/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx
    - components/qmhq/items-summary-progress.tsx
    - lib/actions/inventory-dashboard.ts
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
    - components/stock-out-requests/line-item-table.tsx
    - components/stock-out-requests/stock-out-pdf-button.tsx
    - lib/pdf/documents/stock-out-pdf.tsx

key-decisions:
  - "Removed all useStandardUnitName hook references system-wide"
  - "Replaced global standard unit name with per-item standard_unit_rel join"
  - "Removed totalStandardUnits cross-item aggregate from warehouse KPIs"
  - "Kept per-item standard_stock on warehouse inventory rows with inline unit name"
  - "Stock-out PDF always uses wider layout for per-item units"

patterns-established:
  - "Per-item unit names flow through Supabase joins to standard_units table"
  - "Each display component uses item.standard_unit_rel?.name for unit display"
  - "Cross-item aggregates removed, per-item aggregates retained"

# Metrics
duration: 11 min
completed: 2026-02-16
---

# Phase 53 Plan 03: Refactor Inventory Displays to Per-Item Standard Unit Names

**Per-item standard unit names throughout inventory, warehouse, QMHQ, and stock-out displays with PDF support**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-16T17:22:22Z
- **Completed:** 2026-02-16T17:33:07Z
- **Tasks:** 2 (combined into single commit)
- **Files modified:** 9

## Accomplishments

### Task 1: Warehouse, Inventory, and QMHQ Pages
- Removed useStandardUnitName hook from warehouse, inventory, and QMHQ pages
- Added per-item standard_unit_name to WarehouseInventoryItem interface
- Updated all Supabase queries to join items->standard_units
- Replaced global unitName with per-item standard_unit_rel?.name throughout
- Removed totalStandardUnits cross-item aggregate from warehouse KPIs
- Kept per-item standard_stock on warehouse inventory rows with inline unit name (e.g., "120 pcs", "50 kg")
- Updated ItemsSummaryProgress component to use per-item standardUnitName prop
- Updated inventory-dashboard server action to include standard unit names in transaction data
- Updated QMHQ detail page to pass standardUnitName to itemsProgressData

### Task 2: Stock-Out Displays and PDF
- Removed useStandardUnitName from stock-out request detail page
- Added unit_name field to LineItemWithApprovals interface
- Updated stock-out line items query to join items->standard_units
- Replaced all unitName references with per-item unit_name in line item table
- Updated stock-out PDF to use per-item unit_name instead of global standardUnitName
- Removed standardUnitName prop from StockOutPDFProps
- Always use wider PDF layout (no conditional layout based on global unit)
- Updated approval displays to show per-item unit names
- Updated inventory transactions query to include standard_unit_rel

## Task Commits

All changes committed atomically:

1. **Tasks 1 & 2: Refactor inventory displays to per-item standard unit names** - `9d65797` (feat)

## Files Modified

**All files:**
- `app/(dashboard)/warehouse/[id]/page.tsx` - Per-item unit names on inventory rows and stock movement; removed totalStandardUnits KPI
- `app/(dashboard)/inventory/page.tsx` - Per-item unit names in transaction list
- `app/(dashboard)/qmhq/[id]/page.tsx` - Per-item unit names for QMHQ items and itemsProgressData
- `components/qmhq/items-summary-progress.tsx` - Per-item standardUnitName prop usage
- `lib/actions/inventory-dashboard.ts` - Added standard_unit_rel join to transactions query
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - Per-item unit names in line items, approvals, and transactions
- `components/stock-out-requests/line-item-table.tsx` - Per-item unit_name for all quantity columns
- `components/stock-out-requests/stock-out-pdf-button.tsx` - Per-item unit_name in data interfaces
- `lib/pdf/documents/stock-out-pdf.tsx` - Per-item unit names throughout PDF rendering

## Decisions Made

None - followed plan exactly as specified.

## Deviations from Plan

None - plan executed exactly as written with all verification criteria met.

## Issues Encountered

None - clean refactor with straightforward per-item unit name substitution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Per-item standard unit display is complete across all inventory, warehouse, QMHQ, and stock-out views. The global useStandardUnitName hook pattern has been fully replaced with per-item database joins.

**What remains:**
- Other file consumers (invoice, PO) may need similar updates if they reference useStandardUnitName
- Live conversion rate previews for stock-in and stock-out request forms (deferred - invoice/PO files modifications out of scope for this commit)

Ready for final cleanup or next phase work.

## Self-Check: PASSED

All claims verified:
- ✓ Commit 9d65797 exists (Tasks 1 & 2)
- ✓ useStandardUnitName removed from warehouse, inventory, QMHQ, stock-out pages
- ✓ Per-item standard_unit_name added to interfaces
- ✓ Supabase queries join items->standard_units
- ✓ totalStandardUnits removed from warehouse KPIs
- ✓ Per-item standard_stock preserved on warehouse inventory rows
- ✓ Stock-out PDF uses per-item unit names

---
*Phase: 53-standard-unit-display-refactor*
*Completed: 2026-02-16*
