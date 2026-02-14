---
phase: 49-conversion-rate-input
plan: 02
subsystem: ui
tags: [react, typescript, forms, po, invoice, conversion-rate, line-items]

# Dependency graph
requires:
  - phase: 49-01
    provides: "ConversionRateInput component for 4-decimal conversion rates"
  - phase: 47-inventory-conversion-rate
    provides: "conversion_rate field in po_line_items and invoice_line_items tables"
provides:
  - "PO creation form with conversion rate input per line item"
  - "Invoice creation form with conversion rate input per line item"
  - "Validation requiring conversion rate on all line items"
affects: [50-standard-unit-display, future-po-editing, future-invoice-editing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Per-line-item conversion rate input pattern in editable tables"]

key-files:
  created: []
  modified:
    - components/po/po-line-items-table.tsx
    - app/(dashboard)/po/new/page.tsx
    - components/invoice/invoice-line-items-table.tsx
    - app/(dashboard)/invoice/new/page.tsx

key-decisions:
  - "Conversion rate required for all line items (validation prevents submit without it)"
  - "Default empty string for conversion_rate forces user to fill (no default 1)"
  - "Display conversion rate in invoice Step 3 summary for transparency"

patterns-established:
  - "ConversionRateInput integrated into line item tables alongside quantity and unit price"
  - "Validation pattern: li.conversion_rate && parseFloat(li.conversion_rate) > 0"

# Metrics
duration: 3min 49sec
completed: 2026-02-14
---

# Phase 49 Plan 02: PO and Invoice Conversion Rate Input Summary

**PO and Invoice creation forms accept conversion rate per line item, resolving Phase 47 TypeScript breaking changes**

## Performance

- **Duration:** 3 min 49 sec
- **Started:** 2026-02-14T11:39:56Z
- **Completed:** 2026-02-14T11:43:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PO line items table has conversion rate input column with ConversionRateInput component
- PO creation validates conversion_rate required on all line items before submit
- Invoice line items (Step 2) have conversion rate input per selected item
- Invoice Step 3 summary displays conversion rate for each line item
- Both PO and Invoice insert payloads include conversion_rate field
- Phase 47 TypeScript errors for po/new and invoice/new resolved

## Task Commits

Each task was committed atomically:

1. **Task 1: Add conversion rate to PO line items table and PO creation** - `633380a` (feat)
2. **Task 2: Add conversion rate to Invoice line items** - `1ce07db` (feat)

## Files Created/Modified
- `components/po/po-line-items-table.tsx` - Added Conv. Rate column and ConversionRateInput to editable line items table
- `app/(dashboard)/po/new/page.tsx` - Added conversion_rate to LineItemFormData, validation, and insert payload
- `components/invoice/invoice-line-items-table.tsx` - Added conversion_rate field to InvoiceLineItemFormData interface
- `app/(dashboard)/invoice/new/page.tsx` - Added Conv. Rate input in Step 2, validation, summary column in Step 3, and insert payload

## Decisions Made
- Conversion rate required for all line items (form validation prevents submit without it)
- Default conversion_rate to empty string (not "1") to force user input and prevent accidental omissions
- Display conversion rate in invoice Step 3 summary table for transparency before submission
- Place Conv. Rate column after Unit Price and before Total in both PO and Invoice tables

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward form integration following established patterns from ConversionRateInput component.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PO and Invoice creation forms fully support conversion rate input
- Ready for Phase 49-03 (Stock-in and Stock-out conversion rate forms) to complete the inventory side
- Phase 50 can integrate StandardUnitDisplay component to show converted quantities
- Type errors for po/new and invoice/new resolved - remaining conversion_rate errors are in stock-out-requests (49-03 scope)

## Self-Check

Verifying all deliverables exist:

**Files modified:**
- components/po/po-line-items-table.tsx - EXISTS
- app/(dashboard)/po/new/page.tsx - EXISTS
- components/invoice/invoice-line-items-table.tsx - EXISTS
- app/(dashboard)/invoice/new/page.tsx - EXISTS

**Commits verified:**
- 633380a (Task 1: PO conversion rate) - EXISTS
- 1ce07db (Task 2: Invoice conversion rate) - EXISTS

**Type check:**
- npx tsc --noEmit app/(dashboard)/po/new/page.tsx - 0 conversion_rate errors
- npx tsc --noEmit app/(dashboard)/invoice/new/page.tsx - 0 conversion_rate errors

## Self-Check: PASSED

All deliverables verified:
- All 4 target files modified successfully
- Both task commits exist in git history
- TypeScript errors for PO and Invoice creation resolved
- ConversionRateInput component properly integrated in both forms
- Validation logic enforces required conversion rate on all line items

---
*Phase: 49-conversion-rate-input*
*Completed: 2026-02-14*
