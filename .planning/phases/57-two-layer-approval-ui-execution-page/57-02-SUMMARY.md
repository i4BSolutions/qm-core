---
phase: 57-two-layer-approval-ui-execution-page
plan: 02
subsystem: ui
tags: [stock-out, two-layer-approval, warehouse-assignment, inventory, supabase, react]

# Dependency graph
requires:
  - phase: 57-01
    provides: L1 approval dialog, line-item-table with per-row buttons, LineItemWithApprovals type

provides:
  - L2WarehouseDialog: warehouse assignment with real-time stock validation and hard qty caps
  - WarehouseAssignmentsTab: grouped view with execution capability and before/after stock display
  - Expandable line item rows showing L2 warehouse breakdown per item
  - 5-tab SOR detail page (Line Items, Warehouse Assignments, Approvals, Transactions, History)
  - Execution from Warehouse Assignments tab with before/after stock display

affects:
  - phase 57-03 (execution page depends on SOR detail having pending transactions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "L2 dialog fetches warehouse stock on warehouse select change (real-time validation)"
    - "Hard input max = min(remaining_l1_qty, warehouse_stock) enforced via AmountInput isAllowed"
    - "warehouseAssignments array built from L2 approvals in fetchData, passed to WarehouseAssignmentsTab"
    - "Pending inventory_transaction created at L2 time (warehouse now known); execution updates it to completed"

key-files:
  created:
    - components/stock-out-requests/l2-warehouse-dialog.tsx
    - components/stock-out-requests/warehouse-assignments-tab.tsx
  modified:
    - components/stock-out-requests/line-item-table.tsx
    - components/stock-out-requests/execution-confirmation-dialog.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx

key-decisions:
  - "L2 dialog hard cap enforced via AmountInput max prop = min(remaining, availableStock)"
  - "Pending inventory_transaction inserted at L2 time (warehouse known); execution simply updates status to completed"
  - "Expandable rows use local expandedItemIds: Set<string> state in LineItemTable component"
  - "WarehouseAssignment.is_executed determined by inventory_transaction.status === completed"
  - "handleExecuteAssignment fetches current stock before opening dialog to show before/after impact"
  - "canExecute = admin role (same as canApprove) for simplicity in this phase"
  - "5-tab SOR detail: Line Items (renamed from Details), Warehouse Assignments (new), Approvals, Transactions, History"

patterns-established:
  - "Multi-step fetch: query line items with approvals, then aggregate L2 children per L1 parent"
  - "txByApprovalId map used to determine is_executed status without additional query per row"

requirements-completed: [APPR-02, APPR-03, APPR-04, APPR-05]

# Metrics
duration: 9min
completed: 2026-02-17
---

# Phase 57 Plan 02: L2 Warehouse Dialog, Assignments Tab & Execution

**L2 warehouse assignment dialog with real-time stock validation (hard qty cap at min of remaining L1 qty and warehouse stock), Warehouse Assignments tab with before/after execution display, and expandable line item rows showing warehouse breakdown**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-17T17:16:33Z
- **Completed:** 2026-02-17T17:25:44Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 updated)

## Accomplishments
- L2WarehouseDialog with real-time per-warehouse stock fetch, hard qty cap enforced via AmountInput max = min(remaining, stock), both-limits error messaging, ConversionRateInput, and pending inventory_transaction creation on submit
- WarehouseAssignmentsTab showing assignments grouped by line item with Execute buttons, Pending/Executed badges
- Execution from WarehouseAssignmentsTab opens ExecutionConfirmationDialog enhanced with optional before/after stock levels (fetched at execution time)
- LineItemTable updated with expandable rows (ChevronDown toggle), real "Assign WH" button wired to onAssignWarehouse prop, L1ApprovalData/L2AssignmentData types
- SOR detail page expanded to 5 tabs with full L2 dialog wiring and warehouse assignment data pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create L2 warehouse assignment dialog** - `639b5e2` (feat)
2. **Task 2: Warehouse Assignments tab, expandable line items, L2 dialog wiring** - `a1c945f` (feat)

## Files Created/Modified
- `components/stock-out-requests/l2-warehouse-dialog.tsx` - L2 warehouse dialog (new)
- `components/stock-out-requests/warehouse-assignments-tab.tsx` - Warehouse Assignments tab (new)
- `components/stock-out-requests/line-item-table.tsx` - Added expandable rows, L1ApprovalData types, real Assign WH button
- `components/stock-out-requests/execution-confirmation-dialog.tsx` - Added optional currentStock/afterStock props
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - 5 tabs, L2 dialog, warehouse assignments pipeline

## Decisions Made
- L2 hard cap enforced via `AmountInput max = min(remaining_to_assign, availableWarehouseStock)` — the `isAllowed` callback in AmountInput prevents typing over the cap
- Pending inventory_transaction created at L2 time (warehouse is now known) — execution simply updates status to `completed`
- `warehouseAssignments` array is built from L2 approvals inside fetchData and passed as flat array to WarehouseAssignmentsTab which groups by line_item_id internally
- `canExecute = admin role` (same as canApprove) — no separate permission needed in this phase
- SOR detail page "Details" tab renamed to "Line Items" as per CONTEXT.md spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error for StockOutReason in inventory_transaction insert**
- **Found during:** Task 1 (L2 warehouse dialog creation)
- **Issue:** `requestReason: string` prop caused TS2769 when inserting into inventory_transactions.reason which expects `Enums<"stock_out_reason">`
- **Fix:** Added `type StockOutReason = Enums<"stock_out_reason">` import and typed the prop as `StockOutReason`
- **Files modified:** components/stock-out-requests/l2-warehouse-dialog.tsx
- **Verification:** `npm run type-check` passes with zero errors
- **Committed in:** 639b5e2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Fix required for type safety; no scope change.

## Issues Encountered
None beyond the StockOutReason type fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- L1 -> L2 -> Execute lifecycle complete from SOR detail page
- Plan 57-03 (dedicated execution page) can build on the same pending transaction pattern
- All warehouse assignment data flows through the detail page correctly

## Self-Check: PASSED

- FOUND: components/stock-out-requests/l2-warehouse-dialog.tsx
- FOUND: components/stock-out-requests/warehouse-assignments-tab.tsx
- FOUND: commit 639b5e2 (Task 1)
- FOUND: commit a1c945f (Task 2)

---
*Phase: 57-two-layer-approval-ui-execution-page*
*Completed: 2026-02-17*
