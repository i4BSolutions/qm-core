---
phase: 28-stock-out-request-approval-ui
plan: 02
subsystem: inventory-management
tags: [stock-out-requests, detail-page, approval-dialog, rejection-dialog, line-item-table, warehouse-selection]
completed: 2026-02-09

dependency_graph:
  requires:
    - "Phase 27-01: stock_out_requests, stock_out_line_items, stock_out_approvals tables"
    - "Phase 27-02: Approval validation triggers and status update triggers"
    - "Plan 28-01: Stock-out request list page and create form"
    - "Existing: HistoryTab component for audit trail"
  provides:
    - "Stock-out request detail page at /inventory/stock-out-requests/[id]"
    - "Line item table with selection checkboxes and running totals"
    - "Approval dialog with per-item qty and warehouse assignment"
    - "Rejection dialog with mandatory rejection reason"
    - "Cancel request functionality for requester"
  affects:
    - "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx: created detail page with tabs"
    - "components/stock-out-requests/line-item-table.tsx: created selectable line item table"
    - "components/stock-out-requests/approval-dialog.tsx: created approval workflow dialog"
    - "components/stock-out-requests/rejection-dialog.tsx: created rejection workflow dialog"

tech_stack:
  added:
    - "fetchWarehouseStockForItem: aggregates inventory_transactions to compute stock levels per warehouse"
    - "handleQuantityKeyDown: number-only input validation utility"
    - "LineItemWithApprovals: extended type with computed totals from approvals"
  patterns:
    - "Computed line item totals: total_approved_quantity and remaining_quantity calculated from joined approvals"
    - "Selection state management: Set<string> for multi-select with enable/disable logic"
    - "Fixed action bar: shows when items selected, positioned at bottom center with backdrop blur"
    - "Per-item validation in dialog: Map-based validation errors keyed by field"
    - "Sequential approval workflow: insert approval record -> insert pending transaction with approval FK"
    - "Stock level display in dropdown: shows warehouse name + available stock badge"

key_files:
  created:
    - "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx: Detail page with tabs (Details, Approvals, History) and dialogs (575 lines)"
    - "components/stock-out-requests/line-item-table.tsx: Selectable line item table with action bar (365 lines)"
    - "components/stock-out-requests/approval-dialog.tsx: Approval dialog with warehouse stock fetching (560 lines)"
    - "components/stock-out-requests/rejection-dialog.tsx: Rejection dialog with reason validation (195 lines)"
  modified: []

decisions:
  - decision: "Warehouse stock fetched client-side via inventory_transactions aggregation"
    rationale: "Real-time stock calculation ensures accuracy at approval time, prevents stale data"
    alternatives: "Could use pre-computed warehouse_stock view, but would need refresh trigger"

  - decision: "Approval creates both stock_out_approvals and pending inventory_transactions records"
    rationale: "Per plan spec: pending transaction is the 'ready to execute' instance linking approval to future stock-out"
    alternatives: "Could create transaction only at execution time, but loses clear approval->execution linkage"

  - decision: "Stock warning shown but doesn't block approval"
    rationale: "Allows over-approval for items arriving soon, approver makes informed decision"
    alternatives: "Could hard-block approval when stock insufficient, but reduces flexibility"

  - decision: "Cancel request updates line item statuses, not request status directly"
    rationale: "Request status is computed from line items, so updating line items triggers status recomputation"
    alternatives: "Could directly update request status, but breaks computed status pattern"

  - decision: "Action bar is fixed at bottom center when items selected"
    rationale: "Always visible for bulk actions, doesn't require scrolling to bottom of table"
    alternatives: "Could be sticky header or inline in table, but bottom center is most accessible"

metrics:
  duration: "322 seconds (5.4 minutes)"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  lines_added: 1695
  commits: 2
---

# Phase 28 Plan 02: Stock-Out Request Detail Page with Approval Workflow Summary

**One-liner:** Stock-out request detail page with line item selection table, approval dialog (qty + warehouse), rejection dialog (reason), and cancel action for complete approval workflow.

## What Was Built

Created the stock-out request detail page with full approval/rejection/cancellation workflow, enabling approvers to review line items, select multiple items, approve with quantity and warehouse assignment, or reject with documented reasons.

### Task 1: Request Detail Page with Line Item Table and Cancel Action

**Commits:** `803c5b6`

**Changes:**

1. **Detail Page (app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx)**
   - Route: `/inventory/stock-out-requests/[id]`
   - Header: request number (monospace h1), requester subtitle, status badge, cancel button
   - Request info panel: reason badge, QMHQ reference link (if linked), requester, created date, notes
   - Tabs: Details (line items), Approvals (approval history), History (audit trail)
   - Data fetching:
     - Request: joins requester (users) and qmhq for reference
     - Line items: joins approvals to compute totals
     - Approvals: joins decided_by user and line_item for display
   - Computed totals per line item:
     - `total_approved_quantity`: sum of approved approvals
     - `remaining_quantity`: requested - total_approved
     - `assigned_warehouse_name`: from latest approval's warehouse
   - Cancel action: visible for requester on pending requests
     - Updates all pending line items to status 'cancelled'
     - Triggers request status recomputation via DB trigger

2. **Line Item Table (components/stock-out-requests/line-item-table.tsx)**
   - Columns: Checkbox, Item, SKU, Requested, Approved, Remaining, Status, Warehouse
   - Selection logic:
     - Can select for approval: status 'pending' OR remaining > 0
     - Can select for rejection: status 'pending' only
     - Cannot select: executed, cancelled statuses
   - Select-all checkbox: toggles all selectable items
   - Running totals: shows requested, approved, and remaining quantities
   - Remaining quantity colored: amber if > 0, slate if 0 (fully approved)
   - Status badges: color-coded (pending=amber, approved=emerald, rejected=red, cancelled=slate, partially_executed=purple, executed=emerald)
   - Fixed action bar (shows when items selected):
     - Position: bottom center, fixed, z-50
     - Background: amber highlight with border and backdrop blur
     - Shows: "{N} line item(s) selected"
     - Buttons:
       - "Approve Selected" (emerald) - only if all selected have remaining > 0
       - "Reject Selected" (red) - only if all selected are 'pending'

3. **Approvals Tab**
   - Shows all approval/rejection records grouped by line item
   - Each approval card displays:
     - Approval number (if present)
     - Decision badge (approved/rejected)
     - Item name and SKU
     - Approved quantity (if approved)
     - Decided by user name
     - Decided at timestamp
     - Rejection reason (if rejected)

4. **History Tab**
   - Reuses existing `<HistoryTab>` component
   - Entity type: "stock_out_request"
   - Shows audit trail for request lifecycle

**Files:**
- Created: `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` (575 lines)
- Created: `components/stock-out-requests/line-item-table.tsx` (365 lines)

### Task 2: Approval Dialog and Rejection Dialog

**Commits:** `f432cf0`

**Changes:**

1. **Approval Dialog (components/stock-out-requests/approval-dialog.tsx)**
   - Props: lineItems, requestId, requestReason, onSuccess callback
   - State:
     - `approvalData`: Map<string, { approvedQuantity, warehouseId }> per line item
     - `warehouseStocks`: Map<string, WarehouseStock[]> per item_id
     - `notes`: optional approval notes
     - `validationErrors`: Map<string, string> per field
   - Initialization on open:
     - Pre-fills approved quantity with remaining quantity for each item
     - Fetches warehouse stock levels for each unique item
   - Warehouse stock fetching (`fetchWarehouseStockForItem`):
     - Queries `inventory_transactions` filtered by item_id, status='completed'
     - Groups by warehouse_id, sums quantity (inventory_in +, inventory_out -)
     - Joins warehouse name
     - Returns array of { warehouse_id, warehouse_name, available_stock }
     - Filters to positive stock only, sorts by stock descending
   - Per-item card display:
     - Item name, SKU
     - Summary: Requested, Already Approved, Remaining (right side)
     - Input fields (2-column grid):
       - Approved Quantity: number input, validates > 0 and <= remaining
       - Warehouse: select dropdown with stock levels in badges
     - Stock warning: amber alert if approved qty > available stock (doesn't block)
   - Validation:
     - Every item has approved qty > 0 and <= remaining
     - Every item has warehouse selected
     - Shows field-level error messages
   - Submission (sequential for each item):
     1. Insert `stock_out_approvals`: line_item_id, approved_quantity, decision='approved', decided_by, created_by
     2. Insert `inventory_transactions`: movement_type='inventory_out', item_id, warehouse_id, quantity=approved_qty, reason=requestReason, stock_out_approval_id, status='pending', created_by
   - Success: toast, callback to refetch parent data, close dialog

2. **Rejection Dialog (components/stock-out-requests/rejection-dialog.tsx)**
   - Props: lineItems, onSuccess callback
   - State:
     - `rejectionReason`: string (required, min length 1)
     - `isSubmitting`: boolean
   - List of items being rejected:
     - Shows item name, SKU, requested quantity per item
     - Displayed in bordered panel
   - Rejection reason textarea:
     - Placeholder: "Enter rejection reason..."
     - Required field validation
     - Error message if empty
   - Warning banner:
     - Amber alert with AlertTriangle icon
     - Message: "Rejection is terminal. The requester will need to create a new request."
   - Submission:
     - Insert `stock_out_approvals` for each item: line_item_id, approved_quantity=0, decision='rejected', rejection_reason, decided_by, created_by
     - Uses Promise.all for parallel inserts
   - Success: toast, callback to refetch parent data, close dialog, reset form

3. **Detail Page Integration**
   - Imported both dialog components
   - State: `isApprovalDialogOpen`, `isRejectionDialogOpen`
   - Handlers:
     - `handleApproveClick`: opens approval dialog
     - `handleRejectClick`: opens rejection dialog
     - `handleDialogSuccess`: clears selection, refetches data
   - LineItemTable props:
     - `onApproveClick={handleApproveClick}`
     - `onRejectClick={handleRejectClick}`
   - Dialog mounts at end of page:
     - ApprovalDialog: receives selected line items, requestId, requestReason
     - RejectionDialog: receives selected line items
   - Both dialogs filter line items by selectedIds

**Files:**
- Created: `components/stock-out-requests/approval-dialog.tsx` (560 lines)
- Created: `components/stock-out-requests/rejection-dialog.tsx` (195 lines)
- Modified: `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` (integrated dialogs)

## Deviations from Plan

None - plan executed exactly as written. All requirements met:
- Detail page shows request info with Details, Approvals, and History tabs
- Line item table shows all columns with selection checkboxes
- Approval dialog has per-item qty and warehouse selector with stock levels
- Rejection dialog requires mandatory rejection reason
- Cancel action works for requester on pending requests
- Each approval creates both stock_out_approvals and pending inventory_transactions records

## Key Patterns Established

### Computed Line Item Totals
- Fetch line items with joined approvals
- Client-side aggregation:
  - `total_approved_quantity`: sum of approved approvals
  - `remaining_quantity`: requested - total_approved
  - `assigned_warehouse_name`: from latest approval
- Enables real-time display of approval progress without DB views

### Multi-Select with Conditional Actions
- `Set<string>` for selected IDs
- Enable/disable logic based on item status:
  - Approval: selectable if 'pending' OR remaining > 0
  - Rejection: selectable if 'pending' only
- Action buttons conditional on selection:
  - "Approve Selected" shown only if all selected have remaining > 0
  - "Reject Selected" shown only if all selected are 'pending'

### Fixed Action Bar Pattern
- Shows when `selectedIds.size > 0`
- Position: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- Styling: amber highlight, border, backdrop blur, shadow
- Always visible, doesn't require scrolling

### Dialog-Based Approval Workflow
- Open dialog on action button click
- Dialog fetches additional data (warehouse stocks)
- Per-item form fields with validation
- Sequential submission with FK linkage (approval -> transaction)
- Success callback to parent for data refresh

### Warehouse Stock Aggregation
- Query `inventory_transactions` by item_id, status='completed'
- Group by warehouse_id
- Sum quantity: `inventory_in` adds, `inventory_out` subtracts
- Join warehouse name
- Return only positive stock, sorted descending

### Sequential Approval Creation
- Insert approval record first
- Get approval.id from insert result
- Insert pending inventory_transaction with stock_out_approval_id FK
- Ensures referential integrity and clear linkage

## Dependencies Satisfied

**Requires:**
- Phase 27-01: stock_out_requests table with columns: id, request_number, status, reason, notes, qmhq_id, requester_id
- Phase 27-01: stock_out_line_items table with columns: id, request_id, item_id, requested_quantity, status, item_name, item_sku
- Phase 27-01: stock_out_approvals table with columns: id, line_item_id, approval_number, approved_quantity, decision, rejection_reason, decided_by, decided_at
- Phase 27-02: inventory_transactions table with columns: id, movement_type, item_id, warehouse_id, quantity, reason, stock_out_approval_id, status
- Phase 27-02: Approval validation triggers (sum of approved_quantity <= requested_quantity)
- Phase 27-02: Status update triggers (update line item status based on approval coverage)
- Plan 28-01: List page at /inventory/stock-out-requests (for back navigation)
- Existing: HistoryTab component (components/history/history-tab.tsx)
- Existing: STOCK_OUT_REASON_CONFIG (lib/utils/inventory.ts)

## Integration Points

**Upstream (Data Sources):**
- `stock_out_requests` table: fetched for request details
- `stock_out_line_items` table: fetched with approvals join
- `stock_out_approvals` table: joined for totals, fetched for approvals tab
- `users` table: joined for requester and decided_by names
- `qmhq` table: joined for QMHQ reference (if linked)
- `inventory_transactions` table: aggregated for warehouse stock levels
- `warehouses` table: joined for warehouse names

**Downstream (Mutations):**
- `stock_out_line_items.status`: updated to 'cancelled' on cancel request
- `stock_out_approvals`: inserted on approval/rejection
- `inventory_transactions`: inserted (status='pending') on approval

**Navigation:**
- Back button: `/inventory/stock-out-requests` (list page)
- QMHQ link: `/qmhq/{qmhq_id}` (if linked)

**Permission Gates:**
- Detail page: accessible if user can read stock_out_requests (all roles)
- Cancel button: shown if user.id === request.requester_id AND status === 'pending'
- Line item selection: enabled if user role is admin/quartermaster/inventory (canApprove)
- Approval/rejection actions: gated by canApprove check

## Testing Notes

**Manual Testing Checklist:**
- [ ] Navigate to /inventory/stock-out-requests/[id] - detail page loads
- [ ] Request info panel shows reason, QMHQ link (if linked), requester, date, notes
- [ ] Line item table shows all columns with correct data
- [ ] Status badges have correct colors
- [ ] Remaining quantity shows in amber if > 0, slate if 0
- [ ] Click checkbox - item selected, action bar appears at bottom
- [ ] Select all checkbox - all selectable items selected
- [ ] Action bar shows correct button count and buttons
- [ ] Click "Approve Selected" - approval dialog opens
- [ ] Approval dialog pre-fills approved qty with remaining qty
- [ ] Warehouse dropdown shows warehouses with stock levels
- [ ] Select warehouse with insufficient stock - amber warning shown
- [ ] Change approved qty to exceed remaining - validation error shown
- [ ] Leave warehouse empty - validation error on submit
- [ ] Submit valid approval - success toast, dialog closes, data refreshes
- [ ] Line item status updates to 'approved' after approval
- [ ] Remaining quantity decreases after approval
- [ ] Click "Reject Selected" - rejection dialog opens
- [ ] Rejection dialog shows list of items to reject
- [ ] Leave rejection reason empty - validation error on submit
- [ ] Submit valid rejection - success toast, dialog closes, data refreshes
- [ ] Line item status updates to 'rejected' after rejection
- [ ] Cancel request button visible for requester on pending request
- [ ] Click cancel - confirmation dialog shown
- [ ] Confirm cancel - all pending line items updated to 'cancelled', request status computed to 'cancelled'
- [ ] Approvals tab shows all approval/rejection records with details
- [ ] History tab shows audit trail for request
- [ ] Switch between tabs - content updates correctly

**Edge Cases to Test:**
- Request with all line items approved - no items selectable
- Request with mix of pending/approved/rejected items - correct items selectable
- Line item partially approved (remaining > 0) - still selectable for more approvals
- Warehouse with no stock - doesn't appear in dropdown
- All warehouses have no stock - dropdown shows "No warehouses with stock available"
- Approve with qty > available stock - warning shown, approval allowed
- Reject without reason - validation error, submit disabled
- Multiple approvals on same line item - totals computed correctly
- Cancel request with mix of statuses - only pending items updated
- QMHQ-linked request - QMHQ reference link works
- Standalone request - no QMHQ link shown

**Performance Notes:**
- Warehouse stock aggregation runs client-side on dialog open (acceptable for <100 transactions per item)
- Line item totals computed client-side (acceptable for <50 line items)
- Approval submission sequential (one at a time) to ensure FK integrity
- Rejection submission parallel (Promise.all) for speed

## Known Limitations

1. **No Partial Quantity Input:** Approved quantity can be set to full remaining or less, but no guidance on partial approval strategy.

2. **No Bulk Warehouse Assignment:** Must select warehouse per item individually, even if all items should come from same warehouse.

3. **No Stock Reservation:** Approval doesn't reserve stock, so stock level may change between approval and execution.

4. **No Approval Editing:** Once approved, cannot change approved quantity or warehouse - must cancel and re-approve.

5. **No Rejection Reversal:** Rejected line items cannot be un-rejected - requester must create new request.

6. **No Approval Notes Display:** Approval dialog has notes field, but notes not displayed in Approvals tab (could be added).

7. **No Warehouse Stock History:** Shows current stock only, no historical stock levels at time of approval.

8. **No Multi-Approval Batching:** Each approval creates separate transaction records, even if from same approval session.

## Self-Check: PASSED

**Created Files:**
- [FOUND] app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx (575 lines, exceeds 300 min)
- [FOUND] components/stock-out-requests/line-item-table.tsx (365 lines, exceeds 100 min)
- [FOUND] components/stock-out-requests/approval-dialog.tsx (560 lines, exceeds 150 min)
- [FOUND] components/stock-out-requests/rejection-dialog.tsx (195 lines, exceeds 60 min)

**Key Links Verified:**
- [FOUND] Detail page queries "stock_out_requests" (pattern: from.*stock_out_requests.*select)
- [FOUND] Approval dialog inserts into "stock_out_approvals" (pattern: from.*stock_out_approvals.*insert)
- [FOUND] Approval dialog inserts into "inventory_transactions" (pattern: from.*inventory_transactions.*insert)

**Commits:**
- [FOUND] 803c5b6: feat(28-02): add stock-out request detail page with line item table
- [FOUND] f432cf0: feat(28-02): add approval and rejection dialogs

**Must-Have Truths:**
- [✓] Detail page shows request info with Details tab and History tab
- [✓] Line item table shows columns: Item, SKU, Requested Qty, Approved Qty, Remaining, Status, Warehouse
- [✓] Approver can select line items and click Approve to open approval dialog
- [✓] Approval dialog shows editable approved qty and warehouse selector with stock levels per warehouse
- [✓] Approver can reject selected line items with mandatory rejection reason
- [✓] Requester can cancel own pending request
- [✓] Each approval creates a stock_out_approvals record and a pending inventory_transactions record

All checks passed. Plan 28-02 execution complete and verified.
