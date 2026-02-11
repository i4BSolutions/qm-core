---
status: testing
phase: 28-stock-out-request-approval-ui
source: 28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md
started: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:00:00Z
---

## Current Test

number: 1
name: Navigation and List Page
expected: |
  "Stock-Out Requests" appears in the sidebar under Inventory section. Clicking it loads a list page at /inventory/stock-out-requests with card view (default) and list view toggle. Requests are grouped by status in card view.
awaiting: user response

## Tests

### 1. Navigation and List Page
expected: "Stock-Out Requests" appears in sidebar under Inventory. List page loads with card/list toggle. Card view groups requests by status.
result: [pending]

### 2. Status Tabs and Search
expected: Status tabs (All, Pending, Approved, Rejected, Cancelled) filter the list with count badges. Search filters by request number or requester name.
result: [pending]

### 3. Create Manual Stock-Out Request
expected: "New Request" button opens create form. Can add multiple line items with category-first item selector. Reason displayed as grid of colored cards. Submit creates request and redirects to detail.
result: [pending]

### 4. Create QMHQ-Linked Request
expected: Navigating to /inventory/stock-out-requests/new?qmhq={id} pre-fills item and quantity from QMHQ. Fields are locked with "Locked" badge. Cannot add/remove line items.
result: [pending]

### 5. Request Detail Page
expected: Detail page shows request number, requester, reason badge, QMHQ link (if linked), notes. Has three tabs: Details (line items), Approvals, History.
result: [pending]

### 6. Approve Line Items
expected: Select pending line items via checkboxes, action bar appears at bottom. Click "Approve Selected" opens dialog with per-item approved qty and warehouse selector showing stock levels. Submit creates approval records.
result: [pending]

### 7. Reject Line Items
expected: Select pending line items, click "Reject Selected". Dialog shows items and requires mandatory rejection reason. Warning about rejection being terminal. Submit marks items rejected.
result: [pending]

### 8. Cancel Own Pending Request
expected: Requester sees Cancel button on their own pending request. Clicking Cancel updates all pending line items to cancelled and triggers request status update.
result: [pending]

### 9. Per-Approval Execution
expected: Each approved approval in the Approvals tab has its own "Execute Stock-Out" button (only when that approval has pending transactions). Clicking executes only that approval's transactions.
result: [pending]

### 10. QMHQ Integration - Stock-Out Status
expected: QMHQ item detail page shows "Request Stock-Out" button when no request exists. When request exists, shows Stock-Out Status card with request number, status badge, total requested qty, and total approved qty.
result: [pending]

### 11. Stock-Out Page Redirect
expected: Old /inventory/stock-out page with ?qmhq= param redirects to new request form. Direct access shows info message explaining new approval workflow with links to View Requests and Create New Request.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
