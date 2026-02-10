---
status: resolved
trigger: "Investigate and fix TWO issues: sor-approval-reselect-and-transactions"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:20:00Z
---

## Current Focus

hypothesis: CONFIRMED - Issue 1: canSelectForApproval function checks (item.status === "pending" || item.remaining_quantity > 0) but line item status changes to "approved" after first approval. Issue 2: SOR detail page has no transactions tab/section and QMHQ fetches stock-out via qmhq_id but approval dialog doesn't set qmhq_id.
test: Fix both issues - adjust canSelectForApproval logic and add qmhq_id to approval dialog's inventory transaction inserts
expecting: Line items with remaining quantity selectable, transactions visible on both pages
next_action: Apply fixes to line-item-table.tsx and approval-dialog.tsx, then verify

## Symptoms

expected:
  Issue 1: A line item with remaining quantity should still be selectable for additional approvals until fully fulfilled.
  Issue 2: When stock-out transactions are created from approvals, they should be visible in the SOR detail page and the QMHQ item route detail page.
actual:
  Issue 1: Line items become greyed out/disabled after first approval even with remaining quantity.
  Issue 2: No stock-out transactions are shown on either page.
errors: No console errors reported for these issues.
reproduction:
  Issue 1: Approve a line item with partial quantity -> try to select the same line item again -> it's greyed out.
  Issue 2: After approval creates stock-out transactions -> go to SOR detail or QMHQ detail -> no transactions shown.
started: These features were built in Phase 28 (stock-out request approval UI). First time testing multi-approval workflow.

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:10:00Z
  checked: /components/stock-out-requests/line-item-table.tsx lines 81-87
  found: canSelectForApproval() checks (item.status === "pending" || item.remaining_quantity > 0) - BUT status changes from "pending" to "approved" after first approval via database trigger
  implication: Once approved once, status becomes "approved" so condition fails even if remaining_quantity > 0

- timestamp: 2026-02-10T00:11:00Z
  checked: /supabase/migrations/052_stock_out_requests.sql and 053_stock_out_validation.sql
  found: inventory_transactions table has stock_out_approval_id column to link transactions to approvals, and also has qmhq_id column for QMHQ linking
  implication: Transactions need qmhq_id set to show on QMHQ page

- timestamp: 2026-02-10T00:12:00Z
  checked: /components/stock-out-requests/approval-dialog.tsx lines 312-326
  found: Approval dialog inserts inventory_transaction with stock_out_approval_id but does NOT set qmhq_id
  implication: Transactions won't show on QMHQ page because qmhq_id is NULL

- timestamp: 2026-02-10T00:13:00Z
  checked: /app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  found: SOR detail page has tabs for "details", "approvals", "history" but NO tab for showing inventory transactions
  implication: Need to add a transactions/executions tab to show completed stock-out transactions

- timestamp: 2026-02-10T00:14:00Z
  checked: /app/(dashboard)/qmhq/[id]/page.tsx lines 210-230
  found: QMHQ detail already fetches stock-out transactions via qmhq_id and displays them in stock-out tab
  implication: QMHQ page will show transactions once qmhq_id is properly set during approval

## Resolution

root_cause: |
  Issue 1: The canSelectForApproval() function in line-item-table.tsx checked (item.status === "pending" || item.remaining_quantity > 0), but the database trigger changes line item status from "pending" to "approved" after the first approval. This caused the condition to fail even when remaining_quantity > 0.

  Issue 2: The approval dialog creates inventory_transactions with stock_out_approval_id but did NOT set qmhq_id. The QMHQ detail page filters transactions by qmhq_id, so transactions were invisible. Additionally, the SOR detail page had no transactions tab to display completed stock-outs.

fix: |
  Issue 1: Modified canSelectForApproval() to check ONLY remaining_quantity > 0 (and not cancelled/executed), removing the status === "pending" check. Line items with remaining quantity are now selectable regardless of their status.

  Issue 2a: Added qmhqId prop to ApprovalDialog and passed request.qmhq_id from SOR detail page. Updated inventory_transaction insert to include qmhq_id.

  Issue 2b: Added inventoryTransactions state to SOR detail page, fetch logic to load transactions by stock_out_approval_id, and a new "Transactions" tab to display them.

verification: |
  1. Start dev server and navigate to a stock-out request with line items
  2. Approve a line item with partial quantity (e.g., approve 5 out of 10 requested)
  3. Verify the line item is still selectable (checkbox enabled, not greyed out)
  4. Approve the remaining quantity
  5. Execute the approvals to create completed inventory transactions
  6. Check SOR detail page "Transactions" tab shows the stock-out transactions
  7. Navigate to linked QMHQ detail page "Stock Out" tab
  8. Verify transactions are displayed there as well

files_changed:
  - /components/stock-out-requests/line-item-table.tsx
  - /components/stock-out-requests/approval-dialog.tsx
  - /app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
