---
phase: 57-two-layer-approval-ui-execution-page
plan: 01
subsystem: ui
tags: [stock-out, approvals, two-layer, progress-bar, dialog, react]

# Dependency graph
requires:
  - phase: 55-database-foundation-useravatar
    provides: layer column in stock_out_approvals, awaiting_admin enum, quartermaster/admin layer values

provides:
  - L1ApprovalDialog: qty-only single-item approval dialog (no warehouse, no inventory_transaction)
  - LineItemProgressBar: 3-segment progress bar with L1/L2/Executed breakdown and tooltip
  - LineItemWithApprovals extended with l2_assigned_quantity and executed_quantity fields
  - LineItemTable rewritten with per-row action buttons (no batch selection)
  - SOR detail page wired to L1 per-row approval flow

affects:
  - 57-02: L2 warehouse assignment dialog will use LineItemTable's "Assign WH" placeholder slot
  - 57-03: Execution page will read executed_quantity from line item data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-row action buttons pattern replacing batch checkbox + floating action bar
    - Dynamic badge label based on computed field (awaiting_admin + l2_assigned_quantity)
    - Layer-aware approval aggregation (quartermaster=L1, admin=L2) in fetchData
    - L2 executed quantity computed via secondary inventory_transactions query

key-files:
  created:
    - components/stock-out-requests/l1-approval-dialog.tsx
    - components/stock-out-requests/line-item-progress-bar.tsx
  modified:
    - components/stock-out-requests/line-item-table.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx

key-decisions:
  - "L1 dialog inserts into stock_out_approvals with decision=approved, no warehouse_id or parent_approval_id — DB trigger auto-sets layer=quartermaster"
  - "L1 dialog does NOT create inventory_transaction — that happens at L2 when warehouse is known"
  - "awaiting_admin status badge shows Qty Approved (blue) when l2_assigned_quantity=0, or Warehouse Assigned (purple) when l2_assigned_quantity>0"
  - "Batch checkbox selection and floating action bar fully removed — replaced with per-row Approve Qty + Reject (X) buttons"
  - "Approvals tab is now read-only history display with L1/L2 layer badges — execute buttons removed (Plan 02/03 handles execution)"
  - "REQUEST_STATUS_CONFIG: partially_approved->Awaiting Warehouse, approved->Ready to Execute"

patterns-established:
  - "Per-row dialog trigger pattern: onApproveItem/onRejectItem callbacks set single-item state, dialog renders conditionally on that state"
  - "Two-layer quantity aggregation: L1=quartermaster layer, L2=admin layer, executed=completed inventory_transactions"

requirements-completed: [APPR-01, APPR-05]

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 57 Plan 01: L1 Per-Row Approval UI Summary

**Per-row L1 qty-only approval flow with 3-segment progress bar, replacing batch checkbox selection across all pending stock-out line items**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-17T17:05:11Z
- **Completed:** 2026-02-17T17:13:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created L1ApprovalDialog that inserts into stock_out_approvals with no warehouse/transaction (correct L1 semantics)
- Created LineItemProgressBar with 3 segments (blue/purple/emerald) and a tooltip showing exact L1/L2/Executed counts
- Rewrote LineItemTable: removed all batch selection logic, added per-row "Approve Qty" + "Reject" buttons, progress bar column
- Updated SOR detail page: layer-aware data fetching, L1 dialog wiring, Approvals tab with L1/L2 badges, updated status labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Create L1 approval dialog, progress bar, and rewrite line-item-table** - `b22ec17` (feat)
2. **Task 2: Wire L1 dialog and per-row actions into SOR detail page** - `9e82d94` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `components/stock-out-requests/l1-approval-dialog.tsx` - Layer 1 qty-only approval dialog for single line item
- `components/stock-out-requests/line-item-progress-bar.tsx` - 3-segment progress bar with Tooltip
- `components/stock-out-requests/line-item-table.tsx` - Rewritten with per-row actions, new LineItemWithApprovals interface
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - Wired to L1 flow, layer-aware fetching, updated status labels

## Decisions Made

- L1 inserts into stock_out_approvals without warehouse_id/parent_approval_id — layer auto-set by DB trigger to quartermaster
- No inventory_transaction created at L1 (warehouse unknown at this stage)
- awaiting_admin badge dynamically shows "Qty Approved" or "Warehouse Assigned" based on l2_assigned_quantity
- Approvals tab made read-only (no execute buttons) — execution deferred to Plan 02/03
- partially_approved request status renamed "Awaiting Warehouse"; approved renamed "Ready to Execute"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- L1 approval flow complete; Line item table has a disabled "Assign WH" placeholder slot ready for Plan 02's L2 dialog
- Plan 02 (L2 warehouse assignment dialog) can proceed immediately
- Plan 03 (execution page) can read executed_quantity field that is now computed in fetchData

## Self-Check: PASSED

All files found and commits verified:
- FOUND: components/stock-out-requests/l1-approval-dialog.tsx
- FOUND: components/stock-out-requests/line-item-progress-bar.tsx
- FOUND: components/stock-out-requests/line-item-table.tsx
- FOUND: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
- FOUND: .planning/phases/57-two-layer-approval-ui-execution-page/57-01-SUMMARY.md
- FOUND commit: b22ec17 (Task 1)
- FOUND commit: 9e82d94 (Task 2)

---
*Phase: 57-two-layer-approval-ui-execution-page*
*Completed: 2026-02-17*
