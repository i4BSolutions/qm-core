---
phase: 32-qmhq-transaction-linking
plan: 02
subsystem: qmhq
tags: [ui-integration, sor-linking, progress-visualization, stock-out]
dependency_graph:
  requires:
    - 32-01 (SOR Transaction Group and Items Summary Progress components)
  provides:
    - Enhanced QMHQ detail page Stock Out tab with SOR-grouped display
    - Full pipeline visibility (Requested → Approved → Executed) in QMHQ context
  affects:
    - QMHQ detail page user experience for item-route workflows
tech_stack:
  added: []
  patterns:
    - useMemo for computed grouping and aggregation
    - SOR relationship join through approval -> line_item -> request chain
    - Null-safe mapping to ensure type compatibility with presentational components
key_files:
  created: []
  modified:
    - app/(dashboard)/qmhq/[id]/page.tsx
decisions:
  - Stock Out tab header conditionally shows Request Stock-Out button only when no SOR exists
  - Empty state includes CTA button for better UX when no transactions exist
  - Fulfillment Progress on Details tab uses same stepped progress bar for consistency across tabs
  - Rejected count logic: rejectedApprovals.length (count rejections, not qty, since rejected approvals have qty=0)
metrics:
  duration: 5min
  tasks_completed: 2
  files_modified: 1
  completed_date: 2026-02-11
---

# Phase 32 Plan 02: QMHQ Stock Out Tab Integration Summary

**One-liner:** Integrated SOR transaction grouping and stepped progress visualization into QMHQ detail page Stock Out tab, providing full pipeline visibility from request to execution with SOR-grouped transaction display.

## What Was Built

### 1. Enhanced Stock-Out Data Fetching (Task 1)

Modified the QMHQ detail page to enhance stock-out transaction queries with SOR relationship joins.

**Key changes:**
- **Updated StockOutTransaction type:** Added `stock_out_approval` with nested `line_item` and `request` to capture full SOR relationship chain
- **Enhanced query:** Modified inventory_transactions query to include `stock_out_approvals -> stock_out_line_items -> stock_out_requests` joins
- **Robust SOR fetch:** Changed SOR query from `.maybeSingle()` to array response with `sorDataArray?.[0] ?? null` for better robustness, added `item_id` to line items for progress calculation
- **Cleanup:** Removed debug console.log statements (`[QMHQ Debug]` lines 224-226)

**SQL join path added:**
```sql
stock_out_approval:stock_out_approvals(
  id, approved_quantity,
  line_item:stock_out_line_items(
    id, requested_quantity, status,
    request:stock_out_requests(
      id, request_number, status
    )
  )
)
```

### 2. Stock Out Tab UI Integration (Task 2)

Replaced the Stock Out tab with SOR-grouped transaction display and stepped progress visualization.

**Key changes:**
- **New imports:** Added `SORTransactionGroup`, `ItemsSummaryProgress`, and `ItemProgressData` type
- **SOR grouping logic:** Added `sorGroupedTransactions` useMemo that groups transactions by `sor.request_number`, maps to non-nullable types for component compatibility
- **Items progress calculation:** Added `itemsProgressData` useMemo that calculates Requested (from QMHQ items), Approved (from SOR line item approvals), Executed (from completed transactions), and Rejected (count of rejected approvals)
- **Replaced Items Summary section:** Old flat summary (lines 842-898) replaced with `<ItemsSummaryProgress items={itemsProgressData} />`
- **Removed standalone SOR card:** Old Stock-Out Request Card (lines 900-965) removed per user decision — SOR info now lives in group headers
- **Replaced transaction list:** Old flat list (lines 980-1020) replaced with SOR-grouped display using `<SORTransactionGroup />` component
- **Enhanced empty state:** Added CTA button when no transactions exist
- **Updated Fulfillment Progress on Details tab:** Replaced old progress bars with `<ItemsSummaryProgress />` for consistency

**Removed sections:**
- Standalone Stock-Out Request Card (~65 lines)
- Old Items Summary with manual calculations (~55 lines)
- Old flat transaction list (~40 lines)
- Conditional SOR status badge next to header button

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Null-safe type mapping in sorGroupedTransactions:** Mapped StockOutTransaction (with nullable status) to non-nullable transaction object to match SORTransactionGroup props, defaulting status to 'pending' and quantity to 0
2. **Rejected count logic:** Count `rejectedApprovals.length` instead of summing quantity, since rejected approvals have `approved_quantity = 0` per database design
3. **Conditional Request Stock-Out button:** Button appears in header only when `!stockOutRequest` to avoid duplicate CTAs
4. **Consistency across tabs:** Fulfillment Progress on Details tab now uses same ItemsSummaryProgress component as Stock Out tab for unified UX

## Technical Details

### Data Flow

1. **Stock-out transactions fetched with SOR joins:** `inventory_transactions` query includes full path to parent SOR
2. **SOR data fetched separately:** `stock_out_requests` with `line_items` and `approvals` for progress calculation
3. **Transactions grouped by SOR:** `sorGroupedTransactions` memo groups by `request_number`, accumulates total qty
4. **Items progress aggregated:** `itemsProgressData` memo calculates approved qty from SOR line item approvals, executed qty from completed transactions

### Type Safety

**StockOutTransaction extended type:**
```typescript
interface StockOutTransaction extends InventoryTransaction {
  item?: { id: string; name: string; sku: string | null } | null;
  warehouse?: { id: string; name: string } | null;
  stock_out_approval?: {
    id: string;
    approved_quantity: number;
    line_item?: {
      id: string;
      requested_quantity: number;
      status: string;
      request?: {
        id: string;
        request_number: string;
        status: string;
      } | null;
    } | null;
  } | null;
}
```

**Mapped transaction for SORTransactionGroup:**
```typescript
{
  id: tx.id,
  quantity: tx.quantity || 0,
  status: tx.status || 'pending',  // Ensure non-nullable
  created_at: tx.created_at || '',
  transaction_date: tx.transaction_date,
  reason: tx.reason,
  notes: tx.notes,
  item: tx.item,
  warehouse: tx.warehouse,
}
```

### Component Integration

**Items Summary Progress placement:**
- Stock Out tab: Directly below header, above transactions
- Details tab: Replaces old Fulfillment Progress section

**SOR Transaction Group:**
- Always-expanded groups (no accordion)
- Compact headers link to `/inventory/stock-out-requests/{sorId}`
- Transactions indented under parent SOR

## Files Changed

### Modified
- `app/(dashboard)/qmhq/[id]/page.tsx` (net change: -81 lines, removed ~160 lines of old UI, added ~79 lines of new logic and UI)

## Verification Results

- ✅ `npm run type-check` passes with no errors
- ✅ `npm run build` succeeds (production build completed)
- ✅ Stock Out tab shows Items Summary with stepped progress bar
- ✅ Transactions grouped by SOR with compact headers
- ✅ Empty state includes Request Stock-Out CTA button
- ✅ Standalone SOR card removed
- ✅ Fulfillment Progress on Details tab uses stepped progress bar

## Self-Check: PASSED

**Files modified:**
- ✅ FOUND: app/(dashboard)/qmhq/[id]/page.tsx (51234 bytes)

**Commits created:**
- ✅ FOUND: c303888 (feat(32-02): enhance stock-out query with SOR relationship joins)
- ✅ FOUND: e85ab09 (feat(32-02): replace Stock Out tab with SOR-grouped display and stepped progress)

## Next Steps

**Phase 32 complete.** All plans executed:
- ✅ 32-01: SOR Transaction Group and Items Summary Progress components
- ✅ 32-02: QMHQ Stock Out tab integration

**Phase success criteria met:**
1. ✅ When admin approves stock-out request linked to QMHQ, inventory transaction has `qmhq_id` populated (already working from FK propagation in approval-dialog.tsx)
2. ✅ QMHQ item detail page shows stock-out transactions via `qmhq_id` link, grouped by parent SOR
3. ✅ Manual stock-out requests (no QMHQ parent) create transactions with NULL `qmhq_id` (no changes needed, existing behavior)

**User-facing improvements:**
- Stock Out tab provides complete pipeline visibility (Requested → Approved → Executed → Pending)
- SOR-grouped transactions with compact headers improve navigation
- Rejected items explicitly shown with badge
- Consistent progress visualization across Details and Stock Out tabs
- Better empty state with CTA guidance

## Integration Notes

**FK propagation path validated:**
1. Stock-out request created with `qmhq_id` → line items inherit via FK
2. Admin approves line item → approval record created with `qmhq_id` (via trigger from Plan 32-01)
3. Execution creates inventory transaction → `qmhq_id` populated from approval record (existing logic in approval-dialog.tsx)

**Query performance:**
- Stock-out transactions query includes 3 nested joins (approval -> line_item -> request)
- SOR query fetches once per QMHQ, includes line items and approvals for progress calculation
- Both queries filtered by `qmhq_id` with indexes in place

**Edge cases handled:**
- Transactions with no SOR grouped under '_ungrouped' key (though rare with QMHQ-linked workflow)
- Null/undefined status defaults to 'pending' for type safety
- Zero requested qty handled in progress percentage calculations (capped at 100%)
