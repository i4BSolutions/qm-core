---
phase: 42-cancellation-guards-lock-mechanism
plan: 03
subsystem: purchase-orders
tags: [ui, matching-tab, po-invoice-stock-comparison, voided-invoice-toggle]
dependencies:
  requires:
    - 42-02-ui-guards-tooltips-progress-bars
    - po-line-items-aggregate-fields
    - invoice-void-functionality
  provides:
    - po-matching-tab-component
    - po-invoice-stock-comparison-ui
  affects:
    - app/(dashboard)/po/[id]/page.tsx
    - components/po/po-matching-tab.tsx
tech_stack:
  added:
    - POMatchingTab component for PO vs Invoice vs Stock-In comparison
  patterns:
    - Aggregate data from po_line_items (invoiced_quantity, received_quantity)
    - Voided invoice toggle pattern (hidden by default)
    - Variance highlighting (amber for under, green for over)
    - Match status icons (checkmark/warning)
key_files:
  created:
    - components/po/po-matching-tab.tsx
  modified:
    - app/(dashboard)/po/[id]/page.tsx
decisions:
  - key: "Use po_line_items aggregate fields instead of fetching invoice line items"
    rationale: "Database triggers already maintain invoiced_quantity and received_quantity on po_line_items. No need to fetch and aggregate invoice line items client-side."
    impact: "Simpler component, leverages existing database-maintained aggregates, no additional queries needed."
  - key: "Single table layout with variance columns"
    rationale: "Per research recommendation, single table is more scannable than side-by-side cards for line-item comparison."
    impact: "Compact, scannable view of all line items with ordered/invoiced/received in one row."
  - key: "Amber highlighting for under-invoiced/under-received"
    rationale: "Amber indicates attention needed (not fully matched). Green checkmark for fully matched items."
    impact: "Visual scan quickly identifies discrepancies without reading numbers."
  - key: "Separate invoice summary section with voided toggle"
    rationale: "Voided invoices are invoice-level data, not line-item breakdown. Separate section shows which invoices contributed to this PO."
    impact: "Clear separation between line-item matching and invoice list. Voided toggle provides transparency without clutter."
metrics:
  duration_seconds: 206
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_date: 2026-02-12
---

# Phase 42 Plan 03: PO Matching Tab Summary

**One-liner:** PO Matching tab displays side-by-side ordered vs invoiced vs received quantities per line item with mismatch highlighting, voided invoice toggle, and variance indicators.

## Overview

Created a new POMatchingTab component that provides a comprehensive matching view for PO line items, showing ordered/invoiced/received quantities in a single table with variance columns and match status icons. Integrated the tab into the PO detail page between Invoices and History tabs. Voided invoices are hidden by default and can be revealed via a toggle checkbox.

## Tasks Completed

### Task 1: Create POMatchingTab component
**Commit:** `ae4daa7`

Created `/home/yaungni/qm-core/components/po/po-matching-tab.tsx` with:

**Matching table features:**
- Single table layout with 7 columns: Item, Ordered, Invoiced, Received, Inv Variance, Rcv Variance, Status
- Item column: Package icon, SKU (amber code), and item name
- Ordered column: Quantity with unit label
- Invoiced column: Amber text if under-invoiced, gray otherwise
- Received column: Amber text if under-received, gray otherwise
- Inv Variance column: Shows difference (invoiced - ordered), amber if negative, green if positive
- Rcv Variance column: Shows difference (received - ordered), amber if negative, green if positive
- Status column: Green checkmark for fully matched, amber warning for mismatches
- Footer row: Total quantities summed across all line items

**Data source:**
- Uses existing `po_line_items.invoiced_quantity` and `po_line_items.received_quantity` aggregate fields
- No additional queries needed - data already maintained by database triggers
- Falls back to 0 if aggregate fields are null

**Invoice summary features:**
- Separate section below matching table
- Lists all invoices linked to this PO
- Displays invoice number (code), supplier invoice number, and total amount in EUSD
- Voided toggle checkbox: "Show voided (N)" appears only if voided invoices exist
- Hidden by default: Only shows non-voided invoices initially
- Voided styling: Grayed out background, strikethrough invoice number, VOID badge, reduced opacity
- VOID badge: Red background/text/border, small uppercase label
- Empty state: "No invoices linked to this PO" when no visible invoices

**Component props:**
```typescript
interface POMatchingTabProps {
  lineItems: (POLineItem & { item?: Pick<Item, "id" | "name" | "sku"> | null })[];
  invoices: Invoice[];
}
```

**Visual indicators:**
- Fully matched (ordered = invoiced = received): Green CheckCircle2 icon
- Mismatch (any quantity difference): Amber AlertTriangle icon
- Under-invoiced/under-received: Amber text on quantity
- Over-invoiced/over-received: Green variance text
- Under-invoiced/under-received: Amber variance text
- Voided invoice: Grayed out, strikethrough, VOID badge, 60% opacity

### Task 2: Integrate Matching tab into PO detail page
**Commit:** `f097c5d`

Modified `/home/yaungni/qm-core/app/(dashboard)/po/[id]/page.tsx`:

**Changes:**
1. **Import added:** `import { POMatchingTab } from "@/components/po/po-matching-tab";`
2. **Tab trigger added:** Between Invoices and History tabs at line 476-478
   ```tsx
   <TabsTrigger value="matching" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
     Matching
   </TabsTrigger>
   ```
3. **Tab content added:** Between Invoices and History TabsContent at line 800-807
   ```tsx
   <TabsContent value="matching" className="mt-6">
     <div className="command-panel corner-accents">
       <POMatchingTab
         lineItems={lineItems}
         invoices={invoices}
       />
     </div>
   </TabsContent>
   ```

**Props passed:**
- `lineItems`: Existing state from `useState<POLineItemWithItem[]>([])` - already fetched with item relations
- `invoices`: Existing state from `useState<InvoiceForPO[]>([])` - already fetched with line_items_count

**Tab styling:**
- Consistent amber active state styling matching other tabs
- Command panel with corner accents wrapper matching other tab content
- mt-6 margin matching other tabs

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

1. **Matching tab appears in PO detail page tabs** ✓
   - Positioned between Invoices and History tabs

2. **Matching table shows each line item with ordered/invoiced/received columns** ✓
   - Seven-column table with all required data

3. **Under-invoiced items have amber text on invoiced column** ✓
   - `isUnderInvoiced` condition applies amber-400 text color

4. **Under-received items have amber text on received column** ✓
   - `isUnderReceived` condition applies amber-400 text color

5. **Fully matched items show green checkmark icon** ✓
   - CheckCircle2 with emerald-400 color when ordered = invoiced = received

6. **Variance columns show negative amounts in amber, positive in green** ✓
   - Inv Variance and Rcv Variance columns with conditional coloring

7. **Invoice summary shows linked invoices with amount** ✓
   - Invoice number, supplier invoice no, and total_amount_eusd displayed

8. **Voided invoices hidden by default** ✓
   - `visibleInvoices` filters out `is_voided` when `showVoided` is false

9. **Toggle checkbox reveals voided invoices with VOID badge and grayed-out styling** ✓
   - Checkbox with "Show voided (N)" label
   - Voided invoices render with grayed background, reduced opacity, VOID badge

10. **Voided invoices show strikethrough on invoice number** ✓
    - `line-through` class applied to invoice_number code element

11. **`npm run type-check` passes** ✓
    ```
    > qm-core@0.1.0 type-check
    > tsc --noEmit
    (no errors)
    ```

12. **`npm run lint` passes** ✓
    ```
    > qm-core@0.1.0 lint
    > next lint
    (no new errors, only pre-existing warnings in other files)
    ```

## Key Decisions

### 1. Use po_line_items aggregate fields instead of fetching invoice line items
**Context:** Needed to show invoiced and received quantities per line item.

**Decision:** Use existing `invoiced_quantity` and `received_quantity` fields from `po_line_items` table, which are maintained by database triggers.

**Rationale:** Database already aggregates invoice line items and stock-in transactions into these fields. No need to fetch invoice line items and aggregate client-side. Simpler component, fewer queries, leverages existing infrastructure.

**Impact:** Component depends on database triggers being correct. No additional data fetching required. Faster rendering.

### 2. Single table layout with variance columns
**Context:** Multiple layout options for comparing PO vs Invoice vs Stock-In.

**Decision:** Single table with ordered/invoiced/received columns plus variance columns.

**Rationale:** Per 42-RESEARCH.md recommendation, single table is more scannable than side-by-side cards for line-item comparison. Users can see all three quantities and variances in one row.

**Impact:** Compact view, easy to scan multiple line items quickly, variance columns reduce mental math.

### 3. Amber highlighting for under-invoiced/under-received
**Context:** Need to visually indicate mismatches.

**Decision:** Amber text for under-invoiced/under-received quantities, amber warning icon for any mismatch, green checkmark for fully matched.

**Rationale:** Amber indicates attention needed (not an error, but not complete). Green indicates fully matched. Consistent with amber theme used throughout PO detail page.

**Impact:** Visual scan quickly identifies which line items need attention without reading numbers.

### 4. Separate invoice summary section with voided toggle
**Context:** Voided invoices need to be visible but not cluttering the view.

**Decision:** Separate "Linked Invoices" section below matching table, with checkbox toggle to show/hide voided invoices.

**Rationale:** Voided invoices are invoice-level data, not per-line-item data. Hiding by default reduces clutter since voided invoices don't contribute to quantities. Toggle provides transparency when needed (e.g., investigating why quantities changed).

**Impact:** Clean default view, transparency on demand, clear separation between line-item matching and invoice list.

## Impact

**User Experience:**
- Quick visual scan of PO fulfillment status at line-item level
- Immediate identification of under-invoiced/under-received items
- Variance columns eliminate mental math ("how far off are we?")
- Voided invoice transparency without clutter
- Single source of truth for "what's the status of this PO?"

**Technical:**
- Leverages existing database-maintained aggregates (no additional queries)
- Reusable component accepting standard PO types
- Client-side state management for voided toggle (no server round-trip)
- Consistent with existing tab pattern on PO detail page

**Business Value:**
- Enables users to quickly identify discrepancies between ordered, invoiced, and received quantities
- Supports financial reconciliation and inventory tracking
- Voided invoice visibility helps audit trail and investigation
- Reduces time spent manually comparing PO, invoices, and stock receipts

## Next Steps

**Plan 04 (if exists):** Continue Phase 42 execution.

**Otherwise:** Phase 42 complete. Proceed to Phase 43 or v1.9 milestone completion.

## Self-Check: PASSED

Verified all claims:

**Created files exist:**
```bash
[ -f "components/po/po-matching-tab.tsx" ] && echo "FOUND: components/po/po-matching-tab.tsx"
# Output: FOUND: components/po/po-matching-tab.tsx
```

**Modified files exist:**
```bash
[ -f "app/(dashboard)/po/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/po/[id]/page.tsx"
# Output: FOUND: app/(dashboard)/po/[id]/page.tsx
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "ae4daa7" && echo "FOUND: ae4daa7"
# Output: FOUND: ae4daa7

git log --oneline --all | grep -q "f097c5d" && echo "FOUND: f097c5d"
# Output: FOUND: f097c5d
```

**Key additions verified:**
```bash
grep -q "POMatchingTab" "components/po/po-matching-tab.tsx" && echo "FOUND: POMatchingTab export"
# Output: FOUND: POMatchingTab export

grep -q "import { POMatchingTab }" "app/(dashboard)/po/[id]/page.tsx" && echo "FOUND: POMatchingTab import"
# Output: FOUND: POMatchingTab import

grep -q 'value="matching"' "app/(dashboard)/po/[id]/page.tsx" && echo "FOUND: Matching tab trigger and content"
# Output: FOUND: Matching tab trigger and content

grep -q "invoiced_quantity" "components/po/po-matching-tab.tsx" && echo "FOUND: invoiced_quantity usage"
# Output: FOUND: invoiced_quantity usage

grep -q "received_quantity" "components/po/po-matching-tab.tsx" && echo "FOUND: received_quantity usage"
# Output: FOUND: received_quantity usage

grep -q "showVoided" "components/po/po-matching-tab.tsx" && echo "FOUND: voided toggle state"
# Output: FOUND: voided toggle state

grep -q "CheckCircle2" "components/po/po-matching-tab.tsx" && echo "FOUND: fully matched icon"
# Output: FOUND: fully matched icon

grep -q "AlertTriangle" "components/po/po-matching-tab.tsx" && echo "FOUND: mismatch warning icon"
# Output: FOUND: mismatch warning icon
```

All files, commits, and key additions verified successfully.
