---
phase: 50-standard-quantity-display
plan: 02
subsystem: transaction-display
tags: [standard-quantities, line-items, pdf-export, ui-integration]
dependency-graph:
  requires: [standard-unit-display-component, conversion-rate-fields]
  provides: [po-line-items-standard-display, invoice-line-items-standard-display, invoice-pdf-standard-qty]
  affects: [po-detail-ui, invoice-detail-ui, invoice-pdf, invoice-creation-ui]
tech-stack:
  added: []
  patterns: [standard-unit-display-integration, footer-totals, pdf-conditional-columns]
key-files:
  created: []
  modified:
    - components/po/po-line-items-table.tsx
    - components/invoice/invoice-line-items-table.tsx
    - lib/pdf/documents/invoice-pdf.tsx
    - components/invoice/invoice-pdf-button.tsx
    - app/(dashboard)/invoice/new/page.tsx
decisions: []
metrics:
  duration: 283 seconds
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 5
  completed: 2026-02-16
---

# Phase 50 Plan 02: PO and Invoice Standard Quantity Display Summary

**One-liner:** Integrated StandardUnitDisplay into PO and Invoice line items tables and added standard qty column to Invoice PDF export

---

## What Was Built

Added standard quantity display to the primary transactional views where users review PO and Invoice line items, including PDF export capability.

### Task 1: Line Items Tables Integration

**PO ReadonlyLineItemsTable:**
- Replaced plain quantity display with `StandardUnitDisplay` component
- Shows original quantity + standard quantity (with unit name) in two-line format
- Added footer row showing total standard qty across all line items
- Uses per-line `conversion_rate` from POLineItem database type

**Invoice ReadonlyInvoiceLineItemsTable:**
- Same StandardUnitDisplay integration in Qty column
- Footer row with total standard qty calculation
- Uses per-line `conversion_rate` from InvoiceLineItem database type

**Footer Totals Pattern:**
```tsx
const totalStandardQty = items.reduce(
  (sum, item) => sum + (item.quantity * (item.conversion_rate ?? 1)),
  0
);

<div className="flex flex-col items-end">
  <span className="text-sm font-mono text-slate-200">
    {totalStandardQty.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}
  </span>
  {unitName && (
    <span className="text-xs text-slate-400">
      {unitName}
    </span>
  )}
</div>
```

### Task 2: Invoice PDF and Creation Summary

**Invoice PDF Document:**
- Added `conversion_rate`, `standard_qty` to lineItems type
- Added `standardUnitName` optional prop to InvoicePDFProps
- Conditional "Std Qty" column in PDF table (12% width when shown)
- Two-line format: standard qty value + unit name (muted)
- Adjusted column widths when standard qty shown (Item: 30% → 25%, Line Total: 25% → 20%)
- Added "Total Standard Qty" row in totals section below Invoice Total
- Uses smaller font (12px vs 14px) for standard qty total

**PDF Column Layout:**
```tsx
const columns: PDFTableColumn[] = [
  { header: "#", key: "index", width: "5%", align: "left" },
  { header: "Item", key: "item", width: standardUnitName ? "25%" : "30%", align: "left" },
  { header: "Qty", key: "quantity", width: "10%", align: "right" },
  ...(standardUnitName ? [{ header: "Std Qty", key: "standard_qty", width: "12%", align: "right" as const }] : []),
  { header: "Unit Price", key: "unit_price", width: "15%", align: "right" },
  { header: "Line Total", key: "line_total", width: standardUnitName ? "20%" : "25%", align: "right" },
  { header: "Received", key: "received", width: "13%", align: "right" },
];
```

**InvoicePDFButton:**
- Added `conversion_rate` to lineItems type
- Added `standardUnitName` prop (passed from parent page)
- Passes both through to InvoicePDF component

**Invoice Detail Page ([id]/page.tsx):**
- Already passing `conversion_rate` and `standardUnitName` (from Phase 47 and useStandardUnitName hook)
- No changes needed - already compatible with updated PDF button

**Invoice Creation Step 3 Summary:**
- Replaced plain quantity display with `StandardUnitDisplay` component
- Uses `parseFloat(li.conversion_rate) || 1` to calculate standard qty
- Shows two-line format in summary table before submission

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add StandardUnitDisplay to PO and Invoice readonly line items tables | 3e841a1 | components/po/po-line-items-table.tsx, components/invoice/invoice-line-items-table.tsx |
| 2 | Add standard qty to Invoice PDF and Invoice creation summary | 9ad4058 | lib/pdf/documents/invoice-pdf.tsx, components/invoice/invoice-pdf-button.tsx, app/(dashboard)/invoice/new/page.tsx |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Technical Implementation

### StandardUnitDisplay Integration Pattern

Both ReadonlyLineItemsTable components follow the same pattern:
1. Import `StandardUnitDisplay` and `useStandardUnitName`
2. Call `useStandardUnitName()` hook at component level
3. Replace quantity cell with `<StandardUnitDisplay>` component
4. Calculate `totalStandardQty` from items array
5. Display total in footer with conditional unit name

### PDF Conditional Rendering

The Invoice PDF uses conditional logic throughout:
- Column definitions include standard qty column only when `standardUnitName` provided
- Table data uses spread operator `...(standardUnitName ? {...} : {})` for optional standard_qty cell
- Totals section includes additional row only when `standardUnitName` present
- Column widths adjust dynamically based on presence of standard qty column

This ensures backward compatibility - PDFs work identically when standard unit name not configured.

### Server vs Client Rendering

**Key constraint:** Invoice PDF uses @react-pdf/renderer (server-rendered), so cannot use React hooks.

**Solution:** Pass `standardUnitName` as prop from parent page component:
- Parent page (client component) calls `useStandardUnitName()` hook
- Passes `unitName` value down to InvoicePDFButton as `standardUnitName` prop
- InvoicePDFButton passes to InvoicePDF
- PDF renders conditionally based on string value, not hook

This pattern allows PDF to remain server-rendered while still accessing dynamic config.

---

## Integration Points

### Dependencies
- `@/components/ui/standard-unit-display` - Core display component
- `@/lib/hooks/use-standard-unit-name` - Dynamic unit name retrieval
- `@react-pdf/renderer` - PDF generation library
- Existing conversion_rate fields in po_line_items and invoice_line_items tables

### Affected Components
- **PO Detail Page** (`/po/[id]`) - Shows standard qty in ReadonlyLineItemsTable
- **Invoice Detail Page** (`/invoice/[id]`) - Shows standard qty in ReadonlyInvoiceLineItemsTable
- **Invoice PDF Export** - Includes standard qty column when unit name configured
- **Invoice Creation Step 3** - Shows standard qty in summary table

### Not Affected
- EditableLineItemsTable (PO form) - conversion rate already shown in separate column
- EditableInvoiceLineItemsTable (Invoice Step 2) - conversion rate already shown in separate column
- Stock movement tables - covered in Phase 50-03
- Warehouse inventory - covered in Phase 50-04

---

## Verification

**TypeScript Check:**
```bash
npx tsc --noEmit 2>&1 | grep -E "(po-line-items|invoice-line-items|invoice-pdf|invoice/new)"
# Result: 0 errors (all files type-safe)
```

**Visual Verification Points:**
1. PO detail page: Standard qty appears below each line item quantity
2. PO detail page footer: Total standard qty displayed with unit name
3. Invoice detail page: Standard qty appears below each line item quantity
4. Invoice detail page footer: Total standard qty displayed with unit name
5. Invoice PDF: Std Qty column appears when unit name configured
6. Invoice PDF totals: Total Standard Qty row appears below Invoice Total
7. Invoice creation Step 3: Standard qty appears in summary table

**Expected Behavior with No Configuration:**
- When `standard_unit_name` not set in system_config: second line hidden, footer shows quantity only, PDF omits standard qty column
- When `standard_unit_name` set to empty string: same behavior (conditional checks for truthy and non-empty)
- When `standard_unit_name` set (e.g., "Standard Units"): all standard qty displays appear

---

## Files Modified

### Component Files
1. **components/po/po-line-items-table.tsx** (+32/-7)
   - Added StandardUnitDisplay and useStandardUnitName imports
   - Updated ReadonlyLineItemsTable to use StandardUnitDisplay in Qty column
   - Added totalStandardQty calculation and footer display

2. **components/invoice/invoice-line-items-table.tsx** (+32/-7)
   - Added StandardUnitDisplay and useStandardUnitName imports
   - Updated ReadonlyInvoiceLineItemsTable to use StandardUnitDisplay in Qty column
   - Added totalStandardQty calculation and footer display

### PDF Files
3. **lib/pdf/documents/invoice-pdf.tsx** (+42/-5)
   - Added conversion_rate, standard_qty to lineItems type
   - Added standardUnitName prop to InvoicePDFProps
   - Added conditional Std Qty column to table
   - Added totalStandardQty calculation
   - Added Total Standard Qty row in totals section

4. **components/invoice/invoice-pdf-button.tsx** (+4/-1)
   - Added conversion_rate to lineItems type
   - Added standardUnitName prop to InvoicePDFButtonProps
   - Passed standardUnitName through to InvoicePDF

### Page Files
5. **app/(dashboard)/invoice/new/page.tsx** (+9/-2)
   - Added StandardUnitDisplay and useStandardUnitName imports
   - Added useStandardUnitName hook call
   - Updated Step 3 summary table to use StandardUnitDisplay in Qty column

---

## Next Steps

**Phase 50-03:** Add StandardUnitDisplay to stock movement tables
- Stock-in transaction lists
- Stock-out transaction lists
- Stock-out request line items
- Warehouse transfer displays

**Phase 50-04:** Add StandardUnitDisplay to warehouse inventory display
- Current stock levels by warehouse
- Available quantity displays
- Warehouse inventory lists
- Item stock by warehouse tables

---

## Self-Check

**File existence:**
```bash
[ -f "components/po/po-line-items-table.tsx" ] && echo "FOUND: components/po/po-line-items-table.tsx"
[ -f "components/invoice/invoice-line-items-table.tsx" ] && echo "FOUND: components/invoice/invoice-line-items-table.tsx"
[ -f "lib/pdf/documents/invoice-pdf.tsx" ] && echo "FOUND: lib/pdf/documents/invoice-pdf.tsx"
[ -f "components/invoice/invoice-pdf-button.tsx" ] && echo "FOUND: components/invoice/invoice-pdf-button.tsx"
[ -f "app/(dashboard)/invoice/new/page.tsx" ] && echo "FOUND: app/(dashboard)/invoice/new/page.tsx"
```
Result: All 5 files FOUND

**Commit existence:**
```bash
git log --oneline --all | grep -q "3e841a1" && echo "FOUND: 3e841a1"
git log --oneline --all | grep -q "9ad4058" && echo "FOUND: 9ad4058"
```
Result: Both commits FOUND

## Self-Check: PASSED

All claimed files and commits exist and are accessible.
