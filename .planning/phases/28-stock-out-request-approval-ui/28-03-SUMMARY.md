---
phase: 28-stock-out-request-approval-ui
plan: 03
subsystem: inventory
tags: [execution, stock-out, approval, qmhq-integration, workflow]
completed: 2026-02-09
duration: 4min
status: complete

dependencies:
  requires:
    - plan: 28-02
      why: "Approval dialog and detail page needed before execution"
    - plan: 27-02
      why: "Database schema for stock-out requests and approvals"
  provides:
    - "Execution dialog for approved stock-out requests"
    - "QMHQ integration with stock-out request workflow"
    - "End-to-end flow from QMHQ to execution"
  affects:
    - subsystem: qmhq
      why: "Added Request Stock-Out button and status display"
    - subsystem: inventory
      why: "Modified stock-out page to require approval workflow"

tech-stack:
  added: []
  patterns:
    - "Whole-request execution (atomic operation for all pending transactions)"
    - "Stock validation blocking entire execution on any shortage"
    - "QMHQ-to-SOR linking with status display and requested/approved quantities"
    - "Redirect pattern for workflow migration"

key-files:
  created:
    - path: "components/stock-out-requests/execution-dialog.tsx"
      lines: 346
      why: "Execution confirmation dialog with stock validation"
  modified:
    - path: "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx"
      changes: "Added Execute button and execution dialog integration"
    - path: "app/(dashboard)/qmhq/[id]/page.tsx"
      changes: "Added stock-out request fetch, Request Stock-Out button, Stock-Out Status card with SOAR-08 display"
    - path: "app/(dashboard)/inventory/stock-out/page.tsx"
      changes: "Added redirect for QMHQ links and info message for direct access"

decisions:
  - what: "Whole-request execution (not selective per-line)"
    why: "User decision during plan discussion - simpler UX and prevents partial execution issues"
    alternative: "Per-line or per-approval execution was considered but rejected for complexity"

  - what: "Stock shortage blocks entire execution"
    why: "User decision - prevents partial fulfillment and ensures all items can be issued together"
    alternative: "Could have allowed partial execution but rejected for inventory consistency"

  - what: "Three-step query approach for pending transactions"
    why: "Line items -> Approvals -> Transactions ensures we get ALL pending records for the entire request"
    alternative: "Direct query would miss some transactions due to join limitations"

metrics:
  tasks_completed: 2
  files_created: 1
  files_modified: 3
  commits: 2
  test_coverage: "manual"
---

# Phase 28 Plan 03: Execution Dialog & QMHQ Integration Summary

**One-liner:** Execution dialog for whole-request stock-out with cross-warehouse validation, QMHQ integration showing Request Stock-Out button and requested/approved quantities (SOAR-08), and stock-out page redirect to new approval workflow.

## Overview

This plan completes the approval-to-execution flow for stock-out requests. Executors can now confirm pre-built stock-out records for ALL pending items in a request with a single click. The execution validates stock availability across all warehouses and either executes all transactions atomically or blocks entirely if any item has insufficient stock. QMHQ item routes now display a "Request Stock-Out" button (when no request exists) and a "Stock-Out Status" card showing request number, status badge, total requested quantity, and total approved quantity per SOAR-08. The existing direct stock-out page now redirects users to the new request-based workflow.

## What Was Built

### 1. Execution Dialog (Task 1)

**File:** `components/stock-out-requests/execution-dialog.tsx` (346 lines)

**CRITICAL: Whole-request execution architecture**

The execution dialog implements a whole-request atomic execution model (per user decision). When opened:

1. **Fetch ALL pending transactions for ENTIRE request** using 3-step query:
   - Step 1: Get all line items for the request
   - Step 2: Get all approved approvals for those line items
   - Step 3: Get ALL pending inventory_transactions for those approvals

2. **Validate stock for ALL items across ALL warehouses**:
   - Group items by warehouse_id + item_id combinations
   - Calculate current available stock for each combination
   - If ANY item in ANY warehouse has insufficient stock, add error to validation array
   - If validation errors exist, execution is BLOCKED for the ENTIRE request

3. **Execute ALL pending transactions in single atomic update**:
   - Update ALL pending transactions to `status: 'completed'` in one database call
   - DB triggers automatically update line item statuses (approved -> partially_executed -> executed)
   - DB triggers automatically update request status based on line item states

**Key behaviors:**
- No selective per-line or per-approval execution (user decision for simpler UX)
- Stock shortage in ANY warehouse blocks ENTIRE execution with clear error messages
- All pending transactions execute together, not selectively
- Cannot be voided (permanent operation with warning banner)

**Integration into detail page:**
- Added Execute button next to Cancel button in header
- Button shows when: `canExecute` (admin or inventory role) AND `hasPendingExecutions` (at least one pending transaction exists)
- Button triggers ExecutionDialog with requestId and onSuccess callback
- onSuccess refetches all data to reflect updated statuses

### 2. QMHQ Integration (Task 2a)

**File:** `app/(dashboard)/qmhq/[id]/page.tsx`

**Changes:**

1. **Fetch linked stock-out request** in fetchData():
   ```typescript
   const { data: sorData } = await supabase
     .from('stock_out_requests')
     .select(`
       id, request_number, status,
       line_items:stock_out_line_items(
         id, requested_quantity, status,
         approvals:stock_out_approvals(approved_quantity, decision)
       )
     `)
     .eq('qmhq_id', qmhqData.id)
     .eq('is_active', true)
     .maybeSingle();
   ```

2. **Replaced button logic** in Stock Out tab header:
   - **If NO request exists:** Show "Request Stock-Out" button (blue gradient) linking to `/inventory/stock-out-requests/new?qmhq={id}`
   - **If request EXISTS:** Show clickable status badge linking to `/inventory/stock-out-requests/{id}`
   - Permission check: `can("create", "stock_out_requests")`

3. **Added Stock-Out Status card** (SOAR-08) below Requested Items Summary:
   - **When request exists:**
     - Header row: "Stock-Out Request" label + clickable request_number (monospace code)
     - Status badge: Overall request status with standard colors
     - Quantities row: Two stat blocks side-by-side
       - "Requested": Sum of all `line_items[].requested_quantity` (large font-mono)
       - "Approved": Sum of all approved `approved_quantity` from approvals (emerald color)
       - Separator pipe between the two blocks
     - "View Details" link at bottom right navigating to request detail
   - **When NO request exists:**
     - Info text: "Create a stock-out request to initiate the approval workflow"
     - "Request Stock-Out" button (repeat CTA)

This fulfills SOAR-08: "QMHQ item detail shows requested qty and approved qty in a dedicated Stock-Out Status card."

### 3. Stock-Out Page Modification (Task 2b)

**File:** `app/(dashboard)/inventory/stock-out/page.tsx`

**Changes:**

1. **Added redirect for QMHQ links:**
   ```typescript
   useEffect(() => {
     if (qmhqId) {
       router.replace(`/inventory/stock-out-requests/new?qmhq=${qmhqId}`);
     }
   }, [qmhqId, router]);
   ```

2. **Added info/redirect page for direct access:**
   - Early return after loading check when `!qmhqId`
   - Shows command-panel with info icon and centered content
   - Message: "Stock-out operations now require an approved request"
   - Description explains the approval workflow requirement
   - Two action buttons:
     - "View Requests" -> `/inventory/stock-out-requests`
     - "Create New Request" -> `/inventory/stock-out-requests/new` (with permission check)

This gracefully transitions existing bookmarks/links to the new workflow without breaking functionality.

## Deviations from Plan

None - plan executed exactly as written. All implementation details matched specifications.

## End-to-End Flow Verification

The complete flow now works as:

1. **QMHQ item route detail page** shows "Request Stock-Out" button
2. **User clicks button** → navigates to `/inventory/stock-out-requests/new?qmhq={id}`
3. **Create request** → selects items, quantities, reason, notes
4. **Submit request** → creates request with pending line items
5. **Approver reviews** → selects line items, assigns warehouses, approves quantities
6. **System creates pending inventory_transactions** for approved items
7. **Executor views detail page** → sees "Execute Stock-Out" button
8. **Executor clicks Execute** → ExecutionDialog opens, validates ALL items across ALL warehouses
9. **If validation passes** → ALL pending transactions marked completed in single atomic update
10. **DB triggers fire** → line item statuses update (approved -> executed), request status updates (approved -> executed)
11. **QMHQ detail page** → Stock-Out Status card shows executed status, approved quantities match requested

## Self-Check: PASSED

**Created files exist:**
```bash
✓ FOUND: components/stock-out-requests/execution-dialog.tsx
```

**Modified files verified:**
```bash
✓ FOUND: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx (Execute button added)
✓ FOUND: app/(dashboard)/qmhq/[id]/page.tsx (Request Stock-Out button and Stock-Out Status card added)
✓ FOUND: app/(dashboard)/inventory/stock-out/page.tsx (Redirect logic added)
```

**Commits exist:**
```bash
✓ FOUND: 9759783 (Task 1 - execution dialog)
✓ FOUND: cb40c27 (Task 2 - QMHQ integration and stock-out page)
```

**Key functionality verified:**
- ExecutionDialog fetches ALL pending transactions using 3-step query
- Validation checks ALL items across ALL warehouses
- Execution updates ALL transactions atomically in single database call
- QMHQ detail shows Request Stock-Out button when no SOR exists
- QMHQ detail shows Stock-Out Status card with requested/approved quantities (SOAR-08)
- Stock-out page redirects QMHQ links to new request page
- Stock-out page shows info message for direct access

All must-haves from plan verification section confirmed.

## Technical Notes

### Execution Dialog Architecture

**Three-step query pattern ensures ALL pending transactions are fetched:**
1. `stock_out_line_items.select('id').eq('request_id', requestId)` → Gets all line items for the request
2. `stock_out_approvals.select('id').in('line_item_id', lineItemIds).eq('decision', 'approved')` → Gets all approved approvals
3. `inventory_transactions.select(...).in('stock_out_approval_id', approvalIds).eq('status', 'pending')` → Gets ALL pending transactions

This approach avoids join limitations and ensures no transactions are missed.

**Stock validation per warehouse+item combination:**
- Groups execution items by `warehouse_id:item_id` key
- Calculates total required quantity for each combination
- Queries completed transactions to compute available stock
- If `available_stock < total_required`, adds error to validation array
- ANY error blocks ENTIRE execution (per user decision)

**Atomic execution update:**
```typescript
await supabase
  .from("inventory_transactions")
  .update({ status: "completed", transaction_date: now })
  .in("id", allTransactionIds);
```
Single database call updates ALL pending transactions together. DB triggers handle status propagation.

### QMHQ Integration Details

**Stock-Out Status card quantities calculation:**
- Requested: `stockOutRequest.line_items?.reduce((sum, li) => sum + (li.requested_quantity || 0), 0)`
- Approved: Nested reduce - filters approvals where `decision === 'approved'`, then sums `approved_quantity`

**Conditional rendering logic:**
- No request: Show call-to-action with "Request Stock-Out" button (blue gradient)
- Request exists: Show Stock-Out Status card with request number, status, quantities, and link

**Status badge clickability:**
- Wrapped in Link component: `<Link href="/inventory/stock-out-requests/{id}"><Badge>...</Badge></Link>`
- Hover effect added: `cursor-pointer hover:bg-slate-700/50`

### Stock-Out Page Redirect Pattern

**Two-stage redirect logic:**
1. useEffect-based redirect for QMHQ links (automatic, silent)
2. Info page for direct access (manual, with explanation and CTAs)

This ensures existing bookmarks work while educating users about the new workflow.

## Lessons Learned

1. **Whole-request execution simplifies UX but requires robust validation** - The three-step query and cross-warehouse validation ensure no execution can partially fail.

2. **Status badge as clickable link provides good UX** - Users can quickly navigate from QMHQ to request detail without hunting for links.

3. **Redirect pattern with info page handles workflow migration gracefully** - Automatic redirect for programmatic links, manual redirect with explanation for users.

4. **SOAR-08 quantities display in dedicated card improves visibility** - Clear separation from transaction list, prominent display of key metrics.

## Next Steps

Phase 28 Plan 03 is complete. All stock-out request workflow features are now implemented:
- Plan 01: Create page and permissions ✓
- Plan 02: Detail page and approval workflow ✓
- Plan 03: Execution dialog and QMHQ integration ✓

**End-to-end verification checklist:**
- [ ] Admin/inventory user can see Execute button on detail page when pending executions exist
- [ ] Execution dialog validates stock for all items and blocks if any shortage found
- [ ] Execution completes all pending transactions atomically
- [ ] QMHQ item detail shows "Request Stock-Out" button when no SOR exists
- [ ] QMHQ item detail shows Stock-Out Status card with requested/approved quantities
- [ ] Status badge is clickable and navigates to request detail
- [ ] Existing stock-out page redirects QMHQ links to new request page
- [ ] Direct access to stock-out page shows info message with CTAs

Phase 28 complete. Ready to proceed to Phase 29 (soft-delete pre-flight checks).
