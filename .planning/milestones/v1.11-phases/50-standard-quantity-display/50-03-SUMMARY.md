---
phase: 50-standard-quantity-display
plan: 03
subsystem: inventory-ui
tags: [standard-quantities, warehouse-ui, inventory-dashboard, stock-out-requests, pdf-export]
dependency-graph:
  requires: [standard-unit-display-component, use-standard-unit-name-hook, conversion-rate-column]
  provides: [warehouse-standard-qty-display, inventory-standard-qty-display, stock-out-standard-qty-display]
  affects: [warehouse-detail, inventory-dashboard, stock-out-request-detail, stock-out-pdf]
tech-stack:
  added: []
  patterns: [two-line-display, aggregated-standard-qty, conversion-rate-per-transaction]
key-files:
  created: []
  modified:
    - app/(dashboard)/warehouse/[id]/page.tsx
    - app/(dashboard)/inventory/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
    - components/stock-out-requests/line-item-table.tsx
    - components/stock-out-requests/stock-out-pdf-button.tsx
    - lib/pdf/documents/stock-out-pdf.tsx
decisions:
  - "Aggregate standard_stock in warehouse inventory by summing standard_qty from transactions"
  - "Show standard qty as second line below original quantity in all displays"
  - "Pass standardUnitName to PDF components to conditionally render columns"
metrics:
  duration: 90 seconds
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 6
  completed: 2026-02-16
---

# Phase 50 Plan 03: Inventory and Stock-Out Standard Quantity Display Summary

**One-liner:** Added standard quantity display to warehouse inventory, inventory dashboard transactions, and stock-out request line items with PDF export support

---

## What Was Built

Extended standard quantity display to inventory management pages and stock-out request workflows, showing standard unit equivalents alongside original quantities throughout the system.

### Warehouse Detail Page Enhancements

**Inventory Table:**
- Added `standard_stock` field to `WarehouseInventoryItem` interface
- Aggregated standard_stock by summing `standard_qty` from inventory_in transactions and subtracting from inventory_out
- Displayed standard stock as second line below current_stock using muted text style
- Used `useStandardUnitName()` hook for dynamic unit name display

**KPI Total Units Card:**
- Added `totalStandardUnits` to KPI calculations
- Displayed aggregated standard units below total units count
- Conditionally rendered based on unitName availability

**Stock Movement Table:**
- Updated quantity column to show standard qty per transaction
- Used `conversion_rate` from each transaction record
- Applied same two-line pattern with +/- prefix matching movement type

### Inventory Dashboard Enhancements

**Transaction List:**
- Added standard qty display to quantity column
- Showed standard calculation: `quantity * conversion_rate`
- Used muted color (#94A3B8) for secondary line
- Imported and used `useStandardUnitName` hook

### Stock-Out Request Enhancements

**Line Item Table Component:**
- Extended `LineItemWithApprovals` interface to include `conversion_rate`
- Added standard qty below all quantity columns: Requested, Approved, Rejected, Remaining
- Used `useStandardUnitName()` hook at component level
- Formatted numbers with 2 decimal places and thousand separators

**Request Detail Page:**
- Updated query to fetch `conversion_rate` from stock_out_line_items
- Passed conversion_rate through to LineItemWithApprovals mapping
- Added standard qty to approvals section quantity display
- Added standard qty to transaction cards (stock-out executions)
- Fetched `conversion_rate` from inventory_transactions for transaction display

**PDF Export (StockOutPDF):**
- Added `conversion_rate` to lineItems and approvals types
- Added optional `standardUnitName` prop to StockOutPDFProps
- Conditionally adjusted column widths when standardUnitName present
- Rendered standard qty as second line in line items table (Requested, Approved, Rejected)
- Added standard qty below approved_quantity in approval history cards
- Used muted color (#94A3B8) matching UI pattern

**PDF Button Component:**
- Imported `useStandardUnitName` hook
- Passed `standardUnitName` to StockOutPDF component
- Updated props to include `conversion_rate` for line items and approvals

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add standard qty to warehouse detail and inventory dashboard | a882d7c | app/(dashboard)/warehouse/[id]/page.tsx, app/(dashboard)/inventory/page.tsx |
| 2 | Add standard qty to stock-out request detail and PDF | 2279a83 | app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx, components/stock-out-requests/line-item-table.tsx, components/stock-out-requests/stock-out-pdf-button.tsx, lib/pdf/documents/stock-out-pdf.tsx |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Technical Implementation

### Warehouse Inventory Aggregation Strategy

The warehouse inventory view presents aggregated stock across multiple transactions, each potentially with different conversion rates. The implementation:

1. Fetches all completed inventory_transactions for the warehouse with `conversion_rate` and `standard_qty`
2. Initializes `standard_stock` to 0 for each item
3. For each transaction:
   - inventory_in: `standard_stock += (standard_qty ?? quantity)`
   - inventory_out: `standard_stock -= (standard_qty ?? quantity)`
4. Displays aggregated `standard_stock` alongside `current_stock`

This approach correctly aggregates standard quantities even when different transactions use different conversion rates.

### Two-Line Display Pattern

All quantity displays follow the consistent two-line pattern:
```tsx
<div className="font-mono text-slate-200">{quantity}</div>
{unitName && (
  <div className="text-xs font-mono text-slate-400 mt-1">
    {(quantity * conversionRate).toLocaleString(...)} {unitName}
  </div>
)}
```

**Styling Consistency:**
- Primary line: `font-mono text-slate-200` (white)
- Secondary line: `text-xs font-mono text-slate-400` (muted)
- Numbers formatted with 2 decimals and thousand separators
- `mt-1` spacing between lines

### PDF Conditional Rendering

The PDF layout adapts based on `standardUnitName` presence:

**Without standard unit:**
- Standard column widths (40% for Item, 13% for quantities)
- Single value per cell (no second line)

**With standard unit:**
- Adjusted widths (30% for Item, 16% for quantities)
- View component with two Text children for each quantity cell
- Secondary text uses fontSize: 8, color: "#94A3B8", fontFamily: "Courier"

### Stock-Out Request Data Flow

```
Stock-Out Request Detail Page
├─> Fetches conversion_rate from stock_out_line_items
├─> Maps to LineItemWithApprovals (includes conversion_rate)
├─> Passes to LineItemTable component
│   └─> Displays standard qty for all quantity columns
├─> Passes to StockOutPDFButton
    └─> Fetches unitName via useStandardUnitName()
    └─> Passes lineItems and approvals with conversion_rate
        └─> StockOutPDF renders conditional columns
```

For approvals, conversion_rate is inherited from the parent line item since approvals don't have their own rate (they approve a portion of the line item's requested quantity).

---

## Integration Points

### Dependencies
- `@/lib/hooks/use-standard-unit-name` - Dynamic unit name retrieval
- `@/components/ui/standard-unit-display` - Not used directly (manual two-line pattern preferred for table cells)

### Database Fields Used
- `inventory_transactions.conversion_rate` - Per-transaction rate
- `inventory_transactions.standard_qty` - Generated column = quantity * conversion_rate
- `stock_out_line_items.conversion_rate` - Per-line-item rate

### Hook Usage
All modified components use `useStandardUnitName()` to:
1. Fetch configured unit name from system_config
2. Conditionally render second line only when unitName is truthy
3. Hide display while loading to avoid flash of empty text

---

## Verification

**TypeScript Check:**
```bash
npx tsc --noEmit 2>&1 | grep -E "(warehouse|inventory|stock-out)" | head -20
# Result: 0 type errors
```

**Files Modified:**
- Warehouse detail: added standard_stock aggregation and display
- Inventory dashboard: added standard qty to transaction list
- Stock-out request detail: added standard qty to line items, approvals, transactions
- Line item table: extended interface, added displays
- PDF button: added hook, passed standardUnitName
- Stock-out PDF: conditional rendering, standard qty columns

---

## Next Steps

**Phase 50-04:** Complete standard quantity integration
- Add standard qty to PO and Invoice line item displays (if not already covered in 50-02)
- Ensure all financial transaction displays include standard qty
- Final verification across all modules

**Testing Checklist:**
1. Warehouse detail shows aggregated standard stock correctly
2. Inventory dashboard transaction list shows per-transaction standard qty
3. Stock-out request line items show standard qty for all columns
4. Stock-out PDF includes standard qty when unit name configured
5. PDF exports without errors when standardUnitName is undefined
6. Existing data with conversion_rate=1 displays correctly

---

## Self-Check

**File existence:**
```bash
[ -f "app/(dashboard)/warehouse/[id]/page.tsx" ] && echo "FOUND: warehouse detail"
[ -f "app/(dashboard)/inventory/page.tsx" ] && echo "FOUND: inventory dashboard"
[ -f "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx" ] && echo "FOUND: stock-out request detail"
[ -f "components/stock-out-requests/line-item-table.tsx" ] && echo "FOUND: line item table"
[ -f "lib/pdf/documents/stock-out-pdf.tsx" ] && echo "FOUND: stock-out PDF"
```
Result: All files found

**Commit existence:**
```bash
git log --oneline --all | grep -q "a882d7c" && echo "FOUND: a882d7c"
git log --oneline --all | grep -q "2279a83" && echo "FOUND: 2279a83"
```
Result: Both commits found

## Self-Check: PASSED

All claimed files and commits exist and are accessible.
