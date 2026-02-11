---
status: complete
phase: 35-per-line-item-execution-ui
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md
started: 2026-02-11T11:00:00Z
updated: 2026-02-11T11:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Per-Approval Execute Button
expected: On the SOR detail page → Approvals tab, each approved approval shows a green "Execute" button. Rejected approvals show a red "Rejected" badge. Already-executed approvals show a gray "Executed" badge.
result: pass

### 2. Execute Confirmation Dialog
expected: Clicking the green "Execute" button opens a confirmation dialog showing item name, quantity, and source warehouse. There's an amber warning "This action is permanent." and a "Confirm Execution" button.
result: pass

### 3. Successful Execution
expected: Clicking "Confirm Execution" completes the stock-out. A success toast appears. The button changes to a gray "Executed" badge. Parent request status updates (e.g., to "Partially Fulfilled" or "Fulfilled").
result: pass

### 4. Insufficient Stock Disabled Button
expected: If a warehouse doesn't have enough stock for an approved approval, the Execute button is disabled (grayed out). Hovering shows a tooltip "Insufficient stock: Need X, Available: Y".
result: pass

### 5. Old Request-Level Execute Removed
expected: There is NO request-level "Execute" button at the top of the SOR detail page. Execution is only per-approval in the Approvals tab.
result: pass

### 6. Approval Qty Max Validation
expected: In the Approve Line Items dialog, the quantity input uses formatted numbers (thousand separators) and physically prevents typing a value exceeding the remaining quantity.
result: pass

### 7. Rejection Flow with Per-Item Qty
expected: Clicking "Reject Selected" opens a dialog with per-item quantity inputs (using formatted number input). Each item shows Requested, Already Approved, Already Rejected, and Remaining. You can specify how much to reject per item. Rejection reason is mandatory.
result: pass

### 8. Rejected Qty Reduces Remaining
expected: After rejecting a quantity, the line item table shows the rejected qty in a "Rejected" column. The "Remaining" column equals Requested - Approved - Rejected.
result: pass

### 9. QMHQ Fulfillment Metrics
expected: On the QMHQ item detail page (Details tab), a "Fulfillment" section shows four metrics: Requested, Approved (emerald), Rejected (red), Executed (blue). Top-right shows "executed/(requested - rejected)" with red "(-N)" if rejections exist.
result: pass

### 10. QMHQ Items Summary Progress Bar
expected: Below the Fulfillment section, the "Item Progress" bar shows a red segment from the right for rejected qty. Legend includes Rejected entry. Counter shows "executed/(requested - rejected)" with red "(-N)" indicator.
result: pass

### 11. QMHQ Empty State (No SOR)
expected: On a QMHQ item detail page with no linked stock-out request, the Fulfillment section shows "No stock-out request linked" instead of metrics.
result: pass

### 12. Status Labels
expected: SOR request status displays "Partially Fulfilled" (for partially_executed) and "Fulfilled" (for executed) instead of old names.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
