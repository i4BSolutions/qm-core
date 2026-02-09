# Phase 28: Stock-Out Request & Approval UI - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete UI for stock-out request creation, multi-round partial approval, and execution. This includes: a new list/detail page for stock-out requests, request creation form (manual and QMHQ-linked), per-line-item approval with warehouse assignment, and modification of the existing stock-out page to require approved requests. The DB foundation (phase 27) is complete — this phase is purely UI and integration.

</domain>

<decisions>
## Implementation Decisions

### Request Creation Flow
- **QMHQ integration**: "Request Stock-Out" button on QMHQ item route detail page (not auto-created on QMHQ creation)
- **QMHQ-linked requests**: Item and quantity pre-filled from QMHQ and locked (not editable)
- **QMHQ-linked requests enforce exactly one line item** (from phase 27 schema)
- **Manual requests**: New dedicated list page and create page for stock-out requests (not inside existing stock-out page)
- **Multiple line items per request**: Manual requests support adding multiple items in a single request
- **Warehouse not selected by requester**: Requester picks item and qty only — approver assigns warehouse during approval
- **Reason field**: Requester picks stock-out reason at creation time (request, consumption, damage, lost, transfer, adjustment)
- **Notes**: Optional notes field (not required)
- **Stock levels not shown**: Request form does not display available stock — approver validates availability
- **List page**: Card/list toggle pattern matching QMHQ/PO pages
- **Detail page**: Full page (not drawer) with Details tab and History tab
- **Line items on detail**: Table rows (columns: Item, SKU, Requested Qty, Approved Qty, Status, Warehouse)
- **Permissions**: Any role with QMHQ access can create requests (proposal, inventory, quartermaster, admin)
- **List visibility**: Role-based — Admin/QM/Inventory see all, others see only their own requests
- **Navigation**: Under Inventory section in sidebar

### Approval Experience
- **Approval scope**: Per line item (not whole request)
- **Multi-round partial approval**: Same line item can be approved multiple times (e.g., request 20 → approve 5 → approve 10 later → 5 remaining)
- **Each approval creates a stock-out execution instance**: Approval action auto-creates a "ready to execute" stock-out record with approved quantities
- **Action flow**: Select line items in table → click Approve/Reject button at bottom → one action type at a time (approve or reject, not mixed)
- **Approve dialog**: Modal shows each selected line with editable approved qty (pre-filled with requested) and warehouse selector with stock levels per warehouse
- **Approval notes**: Optional notes field per approval action (visible on request detail)
- **Reject dialog**: Free text rejection reason, one reason covers all selected lines
- **Rejection is terminal**: Rejected request = end of QMHQ flow. No resubmission — user must create new request if needed
- **QMHQ status not auto-updated**: When request is rejected, user manually updates QMHQ status
- **Approver roles**: Admin + Quartermaster + Inventory
- **Line item totals**: Each line shows requested qty, pending qty, approved qty, yet-to-approve qty

### Status Visibility
- **QMHQ detail**: Status badge only (Pending/Approved/Rejected) with click-to-navigate to request detail
- **List page filters**: Status tabs at top (All / Pending / Approved / Rejected / Cancelled) for quick filtering
- **Card/list info**: Overall computed request status only (no line-level progress on cards)

### Execution Constraints
- **All stock-outs require approved request**: No manual stock-out without approval — existing stock-out page modified
- **Auto-created execution records**: Each approval action creates a stock-out execution instance with approved items/qtys/warehouses
- **One-click execution**: Executor sees pre-built stock-out record and confirms with one click (confirmation dialog required)
- **Whole request execution**: Execute all approved lines at once (not per-line)
- **Stock shortage blocks entire execution**: If any line has insufficient stock in assigned warehouse, entire execution blocked
- **Auto-status update**: Request status auto-updates to Fulfilled after execution completes (computed from line items)
- **Permanent execution**: Executed stock-outs cannot be voided — must do stock-in to correct
- **Executor roles**: Inventory + Admin only

### Claude's Discretion
- Form layout and field arrangement
- Card design for list view
- Loading states and skeleton patterns
- Error messages and toast notifications
- Exact table column widths and responsive behavior
- Approval dialog layout
- Confirmation dialog content and styling

</decisions>

<specifics>
## Specific Ideas

- Approval flow creates stock-out instances automatically: e.g., request has itemA:10, itemB:20 → admin approves itemA:5, itemB:5 → creates stock-out instance #1. Later admin approves itemA:5, itemB:5 again → creates stock-out instance #2. Each executed independently.
- The approval dialog should show available stock per warehouse next to the warehouse selector to help the approver make informed decisions
- Line item table in detail page shows running totals: requested, pending, approved, yet-to-approve quantities

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-stock-out-request-approval-ui*
*Context gathered: 2026-02-09*
