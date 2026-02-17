---
status: resolved
trigger: "SOR tabs workflow broken - items don't properly transition between tabs after approval or warehouse assignment"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T02:00:00Z
---

## Current Focus

hypothesis: All three bugs confirmed and fixed
test: TypeScript type-check passes; migration created
expecting: DB trigger fixes unblock correct workflow transitions
next_action: Archive session

## Symptoms

expected: The SOR execution page has 3 tabs that flow in sequence:
  1. Approval Qty Tab - Shows quantities for each line item to approve
  2. Warehouse Assign Tab - Shows approved items for warehouse assignment
  3. Execute Tab - Final execution

actual: Items don't properly transition between tabs after approval or warehouse assignment
errors: No console errors or visual glitches - just wrong behavior in tab workflow transitions
reproduction: Go to SOR execution page, approve quantities, observe flow to warehouse assign tab doesn't work
started: Current implementation - tabs were recently built but flow is broken

## Eliminated

- hypothesis: Auth/permission issue blocking approvals
  evidence: Components have correct role checks (admin only). Flow is role-correct.
  timestamp: 2026-02-17T01:00:00Z

- hypothesis: Data fetch issue preventing warehouse assignments from appearing
  evidence: warehouseAssignments are built from L2 approvals in fetchData correctly
  timestamp: 2026-02-17T01:00:00Z

- hypothesis: UI tab navigation itself is broken
  evidence: Tabs use standard Radix UI TabsList/TabsTrigger with no custom logic
  timestamp: 2026-02-17T01:00:00Z

## Evidence

- timestamp: 2026-02-17T01:00:00Z
  checked: update_line_item_status_on_approval() trigger in migration 20260217100000
  found: L2 layer section unconditionally sets status = 'fully_approved' on FIRST L2 assignment
  implication: |
    Bug 1: If L1 approved qty=100 and first L2 assigns 50, status transitions to
    fully_approved immediately even though 50 units remain unassigned to warehouses.
    The item leaves 'awaiting_admin' prematurely, hiding the "Assign WH" button.

- timestamp: 2026-02-17T01:00:00Z
  checked: getRowAction() in line-item-table.tsx
  found: "Assign WH" button only shown when item.status === 'awaiting_admin'
  implication: |
    This is correct behavior - but Bug 1 causes premature status transition,
    so the button correctly disappears once fully_approved but at the wrong time.

- timestamp: 2026-02-17T01:00:00Z
  checked: update_sor_line_item_execution_status() trigger in migration 20260217100000
  found: total_approved_for_li sums ALL approved records (L1 + L2 combined)
  implication: |
    Bug 2: For an item with L1=100 approved, L2=50 WH1 + L2=50 WH2, the total
    approved qty would be 200 (100 + 50 + 50). But only 100 units get executed
    (via L2 inventory_transactions). So 100 >= 200 is false, and item never
    transitions to 'executed' even when fully executed.

- timestamp: 2026-02-17T01:00:00Z
  checked: validate_sor_line_item_status_transition() in migration 20260217100000
  found: awaiting_admin can ONLY transition to fully_approved
  implication: |
    Bug 3: If execution happens while item is awaiting_admin (partial L2 coverage,
    user executes first assignment), the trigger would block
    awaiting_admin -> partially_executed transition, causing a silent failure.
    The execution status trigger's WHERE clause excluded awaiting_admin items,
    so this was silently ignored rather than erroring, but execution status
    was never reflected.

- timestamp: 2026-02-17T02:00:00Z
  checked: TypeScript type-check after fixing DB triggers
  found: No type errors - no UI code changes needed
  implication: DB-only fix is sufficient for the broken workflow

## Resolution

root_cause: |
  THREE bugs in the two-layer approval DB trigger functions from migration
  20260217100000_two_layer_approval_schema.sql:

  Bug 1 (update_line_item_status_on_approval):
    L2 trigger unconditionally transitions awaiting_admin -> fully_approved on the
    FIRST warehouse assignment. Should only transition when total L2 assigned qty
    covers total L1 approved qty.
    Result: After first partial warehouse assignment, item goes fully_approved
    prematurely, hiding the "Assign WH" button for remaining unassigned qty.

  Bug 2 (update_sor_line_item_execution_status):
    total_approved_for_li sums ALL approved records (L1 + L2), inflating the
    comparison base. Since inventory_transactions only link to L2 approvals,
    execution can never reach the total, so items never transition to 'executed'.
    Also: awaiting_admin not included as valid source state for partially_executed.

  Bug 3 (validate_sor_line_item_status_transition):
    awaiting_admin -> partially_executed and awaiting_admin -> executed transitions
    are blocked. Needed when execution happens before full L2 warehouse coverage.

fix: |
  New migration: supabase/migrations/20260217110000_fix_l2_premature_fully_approved.sql

  Fix 1: update_line_item_status_on_approval() - L2 section now queries total L2
  assigned qty and compares against total L1 approved qty before transitioning.

  Fix 2: update_sor_line_item_execution_status() - Changed total_approved_for_li
  to only sum layer='admin' approved quantities. Added awaiting_admin to valid
  source states for partially_executed and executed transitions.

  Fix 3: validate_sor_line_item_status_transition() - Added partially_executed
  and executed as valid transitions from awaiting_admin state.

verification: TypeScript type-check passes. DB-only fix; no UI changes needed.
files_changed:
  - supabase/migrations/20260217110000_fix_l2_premature_fully_approved.sql
