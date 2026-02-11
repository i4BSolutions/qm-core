---
phase: 35-per-line-item-execution-ui
plan: 01
subsystem: inventory-execution
tags: [ui, execution, stock-out, per-item-control]

dependency_graph:
  requires:
    - Phase 34 advisory locks and row locking
    - Phase 28 stock-out approval workflow
  provides:
    - Per-approval execution UI pattern
    - Stock availability pre-check with tooltips
    - Cross-tab execution synchronization
  affects:
    - Stock-out request detail page
    - Execution workflow for all stock-out approvals

tech_stack:
  added:
    - BroadcastChannel for cross-tab sync
    - Tooltip component for disabled button feedback
    - Optimistic UI update pattern with rollback
  patterns:
    - Per-line-item action buttons (Execute per approval)
    - Stock pre-check before user interaction
    - Confirmation dialog for permanent actions
    - Cross-tab state synchronization

key_files:
  created:
    - components/stock-out-requests/execution-confirmation-dialog.tsx
  modified:
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx

decisions:
  - title: Per-approval Execute buttons replace request-level execution
    rationale: Enables granular fulfillment - users can execute individual approvals independently instead of being forced to execute everything at once
    alternatives: Keep request-level execution with partial execution support
    decision: Per-approval buttons for maximum flexibility
  - title: Stock check before dialog, not after
    rationale: Users see availability immediately via disabled button + tooltip, avoiding frustration of opening dialog only to find insufficient stock
    alternatives: Check stock inside dialog after user clicks
    decision: Pre-check with tooltip for better UX
  - title: Optimistic update with rollback on error
    rationale: Immediate feedback reduces perceived latency, rollback ensures UI stays consistent on failure
    alternatives: Wait for server response before updating UI
    decision: Optimistic update for better perceived performance
  - title: BroadcastChannel for cross-tab sync
    rationale: Users with multiple tabs open see execution in real-time without manual refresh
    alternatives: No cross-tab sync, rely on manual refresh
    decision: BroadcastChannel with Safari fallback for modern UX

metrics:
  duration: 12min
  completed: 2026-02-11
  tasks: 1
  files: 2
  commits:
    - hash: 42a84b3
      type: feat
      scope: 35-01
      message: implement per-approval execution UI
---

# Phase 35 Plan 01: Per-Approval Execution UI Summary

JWT auth with refresh rotation using jose library

## Objective Achieved

Replaced whole-request execution pattern with per-line-item execution from the approval detail page. Each approved stock-out approval now has its own Execute button with stock pre-check, confirmation dialog, optimistic update, and cross-tab broadcast.

Users can now execute individual approvals independently, enabling granular fulfillment instead of all-or-nothing execution.

## Implementation Details

### ExecutionConfirmationDialog Component

Created a minimal confirmation dialog at `components/stock-out-requests/execution-confirmation-dialog.tsx`:

- Simple prop interface: `itemName`, `quantity`, `warehouseName`, `onConfirm`, `isExecuting`
- Three detail fields displayed as label/value pairs
- Amber warning banner: "This action is permanent. Stock-out transactions cannot be voided."
- Cancel + "Confirm Execution" (emerald-600) buttons
- Loader2 spinner during execution

### SOR Detail Page Refactoring

Refactored `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`:

**Removed:**
- Old `ExecutionDialog` import and usage
- `executingApprovalId`, `executingApprovalNumber`, `isExecutionDialogOpen` state
- `approvalPendingStatus` state and pending transaction checks loop

**Added:**
- `executionDialogState` with approval details
- `isExecuting` flag for button state
- `optimisticExecutedIds` Set for immediate UI feedback
- `approvalStockLevels` Map with `{ available, needed }` per approval
- `handleExecuteApproval()` - Opens confirmation dialog with approval details
- `confirmExecution()` - Executes stock-out, broadcasts, refetches data
- BroadcastChannel listener for `APPROVAL_EXECUTED` messages
- Stock availability calculation after fetching transactions

**Per-Approval Execution UI:**
- Each approval card shows status badge or Execute button
- Rejected approvals: Red "Rejected" badge
- Executed approvals: Gray "Executed" badge (from completed transactions OR optimistic set)
- Approved, not-yet-executed: Green "Approved" badge + green "Execute" button
- Execute button disabled when `hasInsufficientStock` or `isExecuting`
- Tooltip on disabled button shows "Insufficient stock: Need X, Available: Y"
- All approvals wrapped in single `<TooltipProvider>`

**Status Label Updates:**
- `partially_executed` → "Partially Fulfilled"
- `executed` → "Fulfilled"

### Cross-Tab Synchronization

BroadcastChannel pattern:
1. After successful execution, broadcast `{ type: 'APPROVAL_EXECUTED', approvalId, requestId, qmhqId }`
2. Other tabs listening on `qm-stock-out-execution` channel refetch data when matching `requestId`
3. Safari fallback: try/catch around BroadcastChannel usage

### Optimistic Update Pattern

1. User clicks Execute → confirmation dialog opens
2. User confirms → `isExecuting = true`, add `approvalId` to `optimisticExecutedIds`
3. UI immediately shows "Executed" badge
4. API call updates transaction to `status: 'completed'`
5. On success: toast, broadcast, close dialog, refetch
6. On error: remove from `optimisticExecutedIds` (rollback), show error toast

### Stock Availability Pre-Check

After fetching approvals and transactions:
1. For each approved approval without completed transaction
2. Find pending transaction to get `item_id` and `warehouse_id`
3. Calculate available stock: sum of completed `inventory_in` minus `inventory_out`
4. Store as `Map<approvalId, { available, needed }>`
5. In UI: `hasInsufficientStock = available < needed`
6. Disable Execute button and show tooltip when insufficient

## Deviations from Plan

None - plan executed exactly as written.

## Technical Patterns Established

1. **Per-item action buttons** - Each list item (approval) has its own action button instead of bulk operations
2. **Stock pre-check with tooltip** - Validation before user interaction, feedback via disabled state + tooltip
3. **Optimistic update with rollback** - Immediate UI feedback, revert on error
4. **Cross-tab BroadcastChannel** - Real-time sync across browser tabs with Safari fallback
5. **Confirmation dialog for permanent actions** - Two-step process (click → confirm) for irreversible operations

## Verification Results

All verification criteria passed:

- ✅ `npx tsc --noEmit` - No type errors
- ✅ `npm run build` - Build succeeds
- ✅ ExecutionConfirmationDialog exists at `components/stock-out-requests/execution-confirmation-dialog.tsx`
- ✅ SOR detail page no longer imports or renders old ExecutionDialog
- ✅ SOR detail page renders per-approval Execute buttons in Approvals tab
- ✅ BroadcastChannel `qm-stock-out-execution` is used for cross-tab sync
- ✅ Optimistic update pattern (`optimisticExecutedIds` Set) implemented
- ✅ Stock availability pre-check disables button when insufficient
- ✅ `hasPendingExecution` removed from page (not found in grep)

## Must-Haves Delivered

All 7 must-have truths implemented:

1. ✅ Each approved line item in Approvals tab has its own Execute button
2. ✅ Executing one line item changes only that line's status, other approved items remain unchanged
3. ✅ Execute button is disabled (not hidden) when stock insufficient, with tooltip showing available vs needed qty
4. ✅ Confirmation dialog shows item name, quantity, and source warehouse before execution
5. ✅ Old request-level Execute button is removed (clean break)
6. ✅ After execution, parent request status auto-refreshes on the same page via `fetchData()`
7. ✅ BroadcastChannel message sent after successful execution for cross-tab sync

## Files Changed

### Created
- `components/stock-out-requests/execution-confirmation-dialog.tsx` (100 lines)

### Modified
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` (+443, -131 lines)

## Commit

```
42a84b3 feat(35-01): implement per-approval execution UI
```

## Self-Check: PASSED

Created files verification:
```bash
[ -f "components/stock-out-requests/execution-confirmation-dialog.tsx" ]
✓ FOUND: components/stock-out-requests/execution-confirmation-dialog.tsx
```

Commit verification:
```bash
git log --oneline --all | grep -q "42a84b3"
✓ FOUND: 42a84b3
```

All artifacts exist and are committed.
