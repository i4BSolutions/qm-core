---
phase: 53-standard-unit-display-refactor
plan: 02
subsystem: ui
tags: [react, components, pdf, forms, refactor]

# Dependency graph
requires:
  - phase: 53-01-remove-global-infrastructure
    provides: Presentational StandardUnitDisplay component accepting unitName prop

provides:
  - PO/Invoice readonly tables displaying per-item standard unit names
  - Invoice PDF with per-item unit names and no aggregate totals
  - PO creation form with live conversion rate preview
  - Invoice creation with per-item unit name display

affects: [53-03-all-other-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-item-unit-display, live-preview-calculation]

key-files:
  created: []
  modified:
    - components/po/po-line-items-table.tsx
    - components/invoice/invoice-line-items-table.tsx
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - lib/pdf/documents/invoice-pdf.tsx
    - components/invoice/invoice-pdf-button.tsx
    - app/(dashboard)/invoice/new/page.tsx
    - app/(dashboard)/po/new/page.tsx

key-decisions:
  - "Removed useStandardUnitName hook from all PO/Invoice consumers"
  - "Fetch standard_units via items join and pass unit_name through props"
  - "Remove all aggregate standard qty totals from tables and PDF"
  - "Always show Std Qty column in PDF (items always have units now)"
  - "Add live preview below conversion rate input showing calculated standard qty"

patterns-established:
  - "Per-item unit names flow through database joins → component props → StandardUnitDisplay"
  - "Live preview pattern: calculate and show result below input with muted styling"

# Metrics
duration: 8 min
completed: 2026-02-16
---

# Phase 53 Plan 02: PO/Invoice Display Per-Item Unit Names

**Per-item standard unit names in PO/Invoice tables and PDF, with live conversion preview in PO form**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T17:22:20Z
- **Completed:** 2026-02-16T17:30:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Refactored PO and Invoice readonly tables to display per-item unit names
- Removed all aggregate standard qty totals from table footers
- Updated PO/Invoice detail pages to fetch standard_units via items join
- Removed standardUnitName prop from Invoice PDF and PDF button
- Updated Invoice PDF to always show Std Qty column with per-item unit names
- Removed "Total Standard Qty" row from Invoice PDF totals section
- Added unit_name to InvoiceLineItemFormData and mapped from query results
- Updated invoice creation to pass per-item unit names to StandardUnitDisplay
- Added item_standard_unit to PO LineItemFormData
- Implemented live conversion rate preview in PO creation form
- Updated items query to fetch standard_units relation

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor PO/Invoice tables to per-item unit names, remove aggregate totals** - `c27d5b5` (refactor)
2. **Task 2: Add per-item unit names to PDF, invoice creation, and PO live preview** - `1032d59` (feat)

## Files Created/Modified

**Modified:**
- `components/po/po-line-items-table.tsx` - Removed useStandardUnitName, added unit_name to props, removed totalStandardQty, added live preview below conversion rate input
- `components/invoice/invoice-line-items-table.tsx` - Removed useStandardUnitName, added unit_name to props, removed totalStandardQty, updated InvoiceLineItemFormData
- `app/(dashboard)/po/[id]/page.tsx` - Removed useStandardUnitName, updated query to join standard_units, map unit_name from join
- `app/(dashboard)/invoice/[id]/page.tsx` - Removed useStandardUnitName, updated query to join standard_units, removed standardUnitName prop from PDF button, map unit_name for PDF lineItems
- `lib/pdf/documents/invoice-pdf.tsx` - Removed standardUnitName prop, added unit_name to lineItems type, always show Std Qty column, removed Total Standard Qty row
- `components/invoice/invoice-pdf-button.tsx` - Removed standardUnitName prop, added unit_name to lineItems type
- `app/(dashboard)/invoice/new/page.tsx` - Removed useStandardUnitName, updated PO query to join standard_units, map unit_name when populating line items, pass unitName to StandardUnitDisplay in Step 3
- `app/(dashboard)/po/new/page.tsx` - Updated items query to fetch standard_units relation

## Decisions Made

None - followed plan exactly as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - clean refactor with consistent pattern application across all consumers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

PO and Invoice consumers fully updated. All standard qty displays now show per-item unit names (e.g., "25 kg", "120 pcs") instead of a global unit. Live preview in PO form provides immediate feedback on conversion rate calculations.

**Remaining consumers for Plan 03:**
- Warehouse inventory pages
- Stock movement pages
- Any other components using StandardUnitDisplay

Ready for 53-03: Update all other consumers (warehouse inventory, stock movements, etc.) to fetch and pass per-item unit names.

## Self-Check: PASSED

All claims verified:
- ✓ Commit c27d5b5 exists (Task 1)
- ✓ Commit 1032d59 exists (Task 2)
- ✓ All modified files exist and contain expected changes
- ✓ No useStandardUnitName references in updated files (verified via grep)
- ✓ No totalStandardQty calculations in tables (verified via grep)
- ✓ unit_name prop added to component interfaces (verified via grep)
- ✓ Live preview code present in PO table (verified via grep)

---
*Phase: 53-standard-unit-display-refactor*
*Completed: 2026-02-16*
