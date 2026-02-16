---
phase: 50-standard-quantity-display
plan: 04
subsystem: ui-integration
tags: [standard-quantities, qmhq-detail, pdf-export, progress-display]
dependency-graph:
  requires: [standard-unit-display-component, use-standard-unit-name-hook, conversion-rate-schema]
  provides: [qmhq-standard-qty-display, pdf-standard-qty-export]
  affects: [qmhq-ui, invoice-pdf, stock-out-pdf, items-progress-ui]
tech-stack:
  added: []
  patterns: [two-line-display, aggregate-calculation, pdf-prop-wiring]
key-files:
  created: []
  modified:
    - app/(dashboard)/qmhq/[id]/page.tsx
    - components/qmhq/items-summary-progress.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
decisions:
  - "Use per-transaction and per-approval conversion rates for accurate standard qty calculations in progress aggregates"
  - "Skip aggregate standard qty display on PO detail page (invoiced/received totals) as they span multiple items with different rates"
  - "Stock-out request list page uses cards without quantity columns, so no standard qty display needed there"
metrics:
  duration: 327 seconds
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 5
  completed: 2026-02-16
---

# Phase 50 Plan 04: QMHQ Detail Standard Qty and PDF Export Wiring Summary

**One-liner:** Integrated standard quantity display in QMHQ item details and progress summary, wired standardUnitName prop to Invoice and Stock-Out PDF buttons

---

## What Was Built

Completed the standard quantity integration across QMHQ detail views and PDF export buttons, enabling users to see standard unit equivalents alongside original quantities in item tracking and progress displays.

### QMHQ Detail Page Enhancements

**Item Route Display:**
- Added standard qty below item quantities in QMHQ item list
- Shows two-line format: original qty + unit, then standard qty + unit name
- Uses conversion_rate from qmhq_items table
- Added conversion_rate to qmhq_items query

**Items Summary Progress Component:**
- Extended ItemProgressData interface with optional standardRequested, standardApproved, standardExecuted fields
- Computed standard quantities in QMHQ detail page using per-source conversion rates:
  - standardRequested: item.quantity × item.conversion_rate
  - standardApproved: sum of (approval.approved_quantity × approval.conversion_rate)
  - standardExecuted: sum of (transaction.quantity × transaction.conversion_rate)
- Updated legend rows to show standard qty below each status quantity
- Used muted colors for standard qty lines (slate-500, blue-500/60, emerald-500/60)

**Stock-Out Transaction Query:**
- Added conversion_rate to inventory_transactions query
- Added conversion_rate to stock_out_approvals and stock_out_line_items selects
- Enables accurate per-transaction standard qty calculation

### PDF Export Wiring

**Invoice Detail Page:**
- Imported useStandardUnitName hook
- Computed standard_qty for each line item: quantity × conversion_rate
- Passed conversion_rate and standard_qty in lineItems array
- Passed standardUnitName prop to InvoicePDFButton
- Invoice PDFs now include standard quantity column when unit name configured

**Stock-Out Request Detail Page:**
- Passed standardUnitName={unitName} to StockOutPDFButton
- Enables standard qty display in stock-out request PDFs
- Uses existing conversion_rate data from line items and approvals

**PO Detail Page:**
- Added useStandardUnitName hook import for future use
- PO detail page uses ReadonlyLineItemsTable which already shows standard qty (from Plan 02)
- Skipped aggregate standard qty display for invoiced/received totals (multi-item aggregates with varying rates)

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add standard qty to QMHQ detail and items summary progress | f33d553 | app/(dashboard)/qmhq/[id]/page.tsx, components/qmhq/items-summary-progress.tsx |
| 2 | Wire standardUnitName to PDF buttons in PO, Invoice, SOR pages | 94cd2d2 | app/(dashboard)/invoice/[id]/page.tsx, app/(dashboard)/po/[id]/page.tsx, app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Stock-out request list page quantity display**
- **Found during:** Task 2
- **Issue:** Plan mentioned updating stock-out request list page quantity columns, but the list page uses RequestCard component which only shows item count, not individual quantities
- **Fix:** Verified that RequestCard doesn't display quantities, so no changes needed
- **Files checked:** app/(dashboard)/inventory/stock-out-requests/page.tsx, components/stock-out-requests/request-card.tsx
- **Commit:** N/A (no code changes needed)

**2. [Rule 3 - Blocking Issue] PO detail aggregate quantities**
- **Found during:** Task 2
- **Issue:** PO detail page shows aggregate invoiced/received quantities that span multiple items with different conversion rates
- **Fix:** Skipped standard qty display for these aggregates as a single conversion rate cannot represent mixed-item totals accurately
- **Files affected:** app/(dashboard)/po/[id]/page.tsx
- **Commit:** N/A (added hook import for future use, but no aggregate display logic)

---

## Technical Implementation

### Standard Quantity Calculation Pattern

**Per-Item Display:**
```tsx
{unitName && item.quantity != null && item.conversion_rate && (
  <div className="text-xs font-mono text-slate-400">
    {((item.quantity || 0) * (item.conversion_rate ?? 1)).toLocaleString(...)} {unitName}
  </div>
)}
```

**Aggregate Calculation:**
```typescript
// Standard Requested (from qmhq_items)
const standardRequested = requested * itemConversionRate;

// Standard Approved (from stock_out_approvals)
standardApproved += approvals.reduce((sum, a) =>
  sum + ((a.approved_quantity || 0) * (a.conversion_rate ?? 1)), 0
);

// Standard Executed (from inventory_transactions)
const standardExecuted = transactions.reduce((sum, t) =>
  sum + ((t.quantity || 0) * (t.conversion_rate ?? 1)), 0
);
```

### Query Enhancement Pattern

Added conversion_rate to all quantity-related queries:
- qmhq_items select
- inventory_transactions select (stock-out transactions)
- stock_out_approvals nested select
- stock_out_line_items nested select

This ensures conversion_rate is available at each aggregation level for accurate standard qty computation.

### Progress Display Pattern

ItemsSummaryProgress legend rows use nested divs for two-line display:
```tsx
<div className="flex items-center text-blue-400">
  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
  <div>
    <div>Approved: {item.approved}</div>
    {unitName && item.standardApproved != null && (
      <div className="text-blue-500/60 font-mono">
        {item.standardApproved.toLocaleString(...)} {unitName}
      </div>
    )}
  </div>
</div>
```

---

## Integration Points

### Data Flow

1. **QMHQ Detail Query** → Fetches conversion_rate with items and transactions
2. **Aggregate Calculation** → Computes standard quantities using per-source rates
3. **ItemsSummaryProgress** → Receives pre-computed standard quantities
4. **Display Layer** → Uses useStandardUnitName to show/hide based on configuration

### PDF Export Flow

1. **Detail Page** → Fetches conversion_rate with line item data
2. **PDF Button Prop** → Passes standardUnitName and per-item conversion_rate/standard_qty
3. **PDF Component** → Renders standard qty column conditionally based on standardUnitName

---

## Verification

**TypeScript Check:**
```bash
npx tsc --noEmit 2>&1 | grep -E "(qmhq|items-summary|po/\[id\]|invoice/\[id\]|stock-out-requests)"
# Result: 0 errors
```

**Standard Qty Display Locations:**
- ✓ QMHQ item quantities in item route display
- ✓ Items summary progress requested/approved/executed
- ✓ Invoice PDF export data
- ✓ Stock-Out Request PDF export data
- ✓ PO detail page hook available (aggregate display deferred)
- ⊘ Stock-out request list page (no quantity columns in card view)

**Conversion Rate Data:**
- ✓ qmhq_items query includes conversion_rate
- ✓ inventory_transactions query includes conversion_rate
- ✓ stock_out_approvals query includes conversion_rate
- ✓ stock_out_line_items query includes conversion_rate

---

## User-Facing Changes

### QMHQ Detail Page

**Before:**
- Item quantities showed only original unit
- Progress summary showed only original quantities

**After:**
- Item quantities show two-line display with standard qty below
- Progress summary legend shows standard qty equivalents for requested/approved/executed
- Standard qty calculations use per-transaction conversion rates for accuracy

### Invoice Detail Page

**Before:**
- InvoicePDFButton called without standardUnitName
- PDF had no standard quantity data

**After:**
- InvoicePDFButton receives standardUnitName prop
- Line items include conversion_rate and standard_qty
- PDF can display standard quantity column when unit name configured

### Stock-Out Request Detail Page

**Before:**
- StockOutPDFButton called without standardUnitName

**After:**
- StockOutPDFButton receives standardUnitName prop
- PDF can display standard quantities when unit name configured

---

## Next Steps

**Phase 50 Complete:**
All 4 plans in Phase 50 are now complete:
- ✓ 50-01: StandardUnitDisplay component
- ✓ 50-02: PO and Invoice line item tables
- ✓ 50-03: Stock movement tables
- ✓ 50-04: QMHQ detail and PDF export wiring

**Standard Quantity Integration Status:**
- ✓ Component foundation (StandardUnitDisplay)
- ✓ Hook integration (useStandardUnitName)
- ✓ PO line items display
- ✓ Invoice line items display
- ✓ Stock-in/out transaction tables
- ✓ Warehouse inventory display
- ✓ QMHQ item display and progress
- ✓ Invoice PDF export
- ✓ Stock-Out Request PDF export

**Future Considerations:**
1. Add standard qty to PO aggregate displays if/when per-item rates can be meaningfully aggregated
2. Consider adding standard qty to stock-out request cards if detailed view mode is added
3. Monitor user feedback on standard qty display usefulness across different workflows

---

## Self-Check

**File existence:**
```bash
[ -f "app/(dashboard)/qmhq/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/qmhq/[id]/page.tsx"
[ -f "components/qmhq/items-summary-progress.tsx" ] && echo "FOUND: components/qmhq/items-summary-progress.tsx"
[ -f "app/(dashboard)/invoice/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/invoice/[id]/page.tsx"
[ -f "app/(dashboard)/po/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/po/[id]/page.tsx"
[ -f "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx"
```

**Commit existence:**
```bash
git log --oneline --all | grep -q "f33d553" && echo "FOUND: f33d553"
git log --oneline --all | grep -q "94cd2d2" && echo "FOUND: 94cd2d2"
```

**Results:**
- FOUND: app/(dashboard)/qmhq/[id]/page.tsx
- FOUND: components/qmhq/items-summary-progress.tsx
- FOUND: app/(dashboard)/invoice/[id]/page.tsx
- FOUND: app/(dashboard)/po/[id]/page.tsx
- FOUND: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
- FOUND: f33d553
- FOUND: 94cd2d2

## Self-Check: PASSED

All claimed files and commits exist and are accessible.
