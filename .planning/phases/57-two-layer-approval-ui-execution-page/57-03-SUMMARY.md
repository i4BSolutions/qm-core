---
phase: 57-two-layer-approval-ui-execution-page
plan: "03"
subsystem: inventory-execution
tags: [stock-out, execution-queue, sidebar, task-queue]
dependency_graph:
  requires: ["57-01", "57-02"]
  provides: ["EXEC-01", "EXEC-02", "EXEC-03", "EXEC-04"]
  affects: [stock_out_approvals, inventory_transactions, sidebar-navigation]
tech_stack:
  added: []
  patterns: [task-queue-list, filter-bar, broadcast-channel-sync, in-place-update]
key_files:
  created: []
  modified:
    - app/(dashboard)/inventory/stock-out/page.tsx
    - components/layout/sidebar.tsx
decisions:
  - "SOR ID is display-only plain text (not a link) per CONTEXT.md decision"
  - "No new request button on execution page (EXEC-03 overridden by user decision)"
  - "Sidebar 'Stock Out' renamed to 'Execution Queue' at same URL /inventory/stock-out"
  - "BroadcastChannel used for cross-tab sync on execution events"
  - "In-place row update (optimistic) on execution success — no full refetch needed"
  - "Insufficient stock error keeps assignment pending with descriptive toast message"
metrics:
  duration_seconds: 563
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  completed_date: "2026-02-17"
---

# Phase 57 Plan 03: Stock-Out Execution Page Summary

**One-liner:** Task-queue execution page at /inventory/stock-out showing all L2-approved warehouse assignments with per-row execution via simple confirmation dialog, warehouse/status filters, and sidebar rename to "Execution Queue".

## What Was Built

### Task 1: Dedicated Stock-Out Execution Page (commit: 0e058e7)

Completely replaced `app/(dashboard)/inventory/stock-out/page.tsx`. The old page had two modes: an info/redirect screen and a legacy stock-out form. Both were replaced with the execution page.

**Page architecture:**

- **Header**: `PageHeader` with title "Stock-Out Execution" and description "Execute approved warehouse assignments". No action buttons.
- **Filter bar**: Status filter (Pending Execution default, Executed, All) and Warehouse filter (All Warehouses + active warehouse list). Mobile: Popover trigger with active filter count badge. Desktop: inline selects.
- **Data fetch**: Queries `stock_out_approvals` where `layer='admin'` and `decision='approved'` and `is_active=true`, joined with warehouses, stock_out_line_items, stock_out_requests, users, and inventory_transactions. Derives `executionStatus` per assignment: if any linked `inventory_transaction` has `status='completed'` the assignment is "executed", otherwise "pending_execution".
- **Table**: SOR ID (plain text, font-mono text-slate-300, NOT a link), Item name + SKU, Warehouse, Qty, Requester (hidden on mobile), Status badge (solid amber for pending, solid emerald for executed), Execute button (for pending rows only).
- **Executed rows**: `opacity-75` dimming, `text-slate-500` for name/warehouse/requester.
- **Execution flow**: Clicking "Execute" opens `ExecutionConfirmationDialog` (already built in Plan 01). On confirm, updates `inventory_transactions` where `stock_out_approval_id = approvalId` and `status = 'pending'` to `status = 'completed'`. Row updates in-place (optimistic state update). BroadcastChannel broadcasts the event so other open tabs refetch.
- **Error handling**: Insufficient stock trigger errors caught and shown as user-friendly toast: "Insufficient stock — retry later. The assignment will remain for when stock is replenished."
- **Empty states**: When filtering "Pending Execution" with no results: "All assignments have been executed" with emerald CheckCircle2 icon. Generic: "No assignments found" with Package icon.
- **Pagination**: `usePaginationParams` + `Pagination` component per Phase 56 pattern. Filter changes reset to page 1.

**Key links satisfied:**
- Queries `stock_out_approvals` with `layer='admin'` and `decision='approved'`
- Updates `inventory_transactions` status to `completed` on execution
- SOR ID display pattern uses plain text, not amber link styling

### Task 2: Sidebar Navigation Update (commit: de13cd1)

Updated `components/layout/sidebar.tsx` Inventory children:

- Changed: `{ label: "Stock Out", href: "/inventory/stock-out" }`
- To: `{ label: "Execution Queue", href: "/inventory/stock-out" }`

URL is unchanged. Only the display label changes to reflect the new purpose of the page (execution task queue, not stock-out form).

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm run type-check`: passed (exit 0, zero errors)
- `npm run build`: passed (compiled successfully, 10/10 static pages generated)
- All must_have truths satisfied:
  - Navigation to /inventory/stock-out shows execution page (not old stock-out form)
  - Default filter is "Pending Execution"
  - Warehouse filter dropdown with all active warehouses
  - Status filter: Pending Execution / Executed / All
  - Table columns: SOR ID, Item, Warehouse, Qty, Requester, Status, Action
  - SOR ID is plain text (not a link)
  - Execute button opens simple confirmation dialog
  - After execution, row updates in-place (status badge changes, button disappears)
  - No "New Request" button anywhere
  - Sidebar "Execution Queue" under Inventory points to /inventory/stock-out

## Self-Check: PASSED

Files exist:
- app/(dashboard)/inventory/stock-out/page.tsx: FOUND
- components/layout/sidebar.tsx: FOUND

Commits exist:
- 0e058e7 (Task 1 - execution page): FOUND
- de13cd1 (Task 2 - sidebar update): FOUND
