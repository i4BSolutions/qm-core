---
status: resolved
trigger: "stock-out-execute-per-approval"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:15:00Z
---

## Current Focus

hypothesis: Fix implemented successfully - per-approval execution buttons now work
test: Verify that each approved approval gets its own Execute Stock-Out button
expecting: Each approval shows its own button in Approvals tab, execution works independently
next_action: Manual verification in browser

## Symptoms

expected: Each approved line item gets its own 'Execute Stock-Out' button/action - users should be able to execute stock-out for individual approved line items independently
actual: There's one 'Execute Stock-Out' button for the entire request that processes everything at once
errors: No error messages, just wrong behavior
reproduction: Go to a stock-out request detail page that has multiple approved line items - only one bulk Execute Stock-Out button exists
started: This is the current implementation that needs to be changed

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: /app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  found: Single "Execute Stock-Out" button at line 453-460, controlled by hasPendingExecutions flag
  implication: Button appears when any pending transactions exist for entire request

- timestamp: 2026-02-10T00:06:00Z
  checked: /components/stock-out-requests/execution-dialog.tsx
  found: Dialog fetches ALL pending inventory_transactions for entire request (line 128-146), validates stock for all items together, executes all in single atomic operation (line 240-246)
  implication: Current implementation is explicitly designed for bulk execution, not per-approval

- timestamp: 2026-02-10T00:07:00Z
  checked: Database schema 052_stock_out_requests.sql
  found: stock_out_approvals table supports multiple approvals per line_item (line 96-126), each approval can have different approved_quantity
  implication: Database already supports granular per-approval execution, UI just needs to be changed

- timestamp: 2026-02-10T00:08:00Z
  checked: inventory_transactions table relationship
  found: inventory_transactions has stock_out_approval_id foreign key, linking each transaction to specific approval
  implication: Each inventory_transaction already belongs to a specific approval, perfect for per-approval execution

## Resolution

root_cause: The Execute Stock-Out functionality is implemented as a bulk operation that processes all pending inventory_transactions for the entire request in a single dialog (execution-dialog.tsx). The detail page shows a single Execute Stock-Out button (line 453-460) that appears when hasPendingExecutions is true for the entire request. The ExecutionDialog component explicitly fetches ALL pending transactions across all approvals and executes them atomically. This needs to change to per-approval execution where each approval gets its own execute button.

fix:
1. Modified ExecutionDialog to accept approvalId and approvalNumber parameters
2. Changed dialog to fetch and execute transactions for specific approval only (not entire request)
3. Removed bulk Execute Stock-Out button from page header
4. Added per-approval Execute Stock-Out buttons in Approvals tab
5. Added approvalPendingStatus state to track which approvals have pending executions
6. Each approval now shows its own Execute button when it has pending transactions

verification: TypeScript compilation passes. Manual verification needed: navigate to stock-out request detail page with multiple approved approvals, verify each approval shows its own Execute Stock-Out button in the Approvals tab, click one button and verify only that approval's transactions are executed while others remain pending.

files_changed:
  - /home/yaungni/qm-core/components/stock-out-requests/execution-dialog.tsx
  - /home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
