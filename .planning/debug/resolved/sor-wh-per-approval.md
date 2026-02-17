---
status: resolved
trigger: "Warehouse assignment in SOR execution page is scoped per line item instead of per approval record. It should be per approval record and only assignable in the Warehouse Assignment tab."
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. The warehouse assignment dialog (L2WarehouseDialog) is correctly scoped per L1 approval record (it receives l1Approval.id and stores parent_approval_id). However, the PROBLEM is in WHERE the L2 dialog is triggered: it is only triggered from the LINE ITEMS TAB (via "Assign WH" button in line-item-table.tsx), NOT from the Warehouse Assignments tab. The Warehouse Assignments tab shows already-created L2 assignments (execute only), and has no button to ADD NEW warehouse assignments from that tab.

The issue the user sees is: the "Assign Warehouse" button appears on the Line Items tab (per line item row), not on the Warehouse Assignments tab. From the Warehouse Assignments tab perspective, a new user would not know to go back to Line Items tab to assign. The UX flow is confusing/wrong per the stated requirement.

Additionally, there is a validation bug in L2WarehouseDialog (line-item-table.tsx getRowAction): only ONE l1 approval (the first with remaining qty) is offered at a time for assignment. If there are multiple L1 approvals for one line item, only the first unfinished one is wired. This matches the spec (the L2 dialog is called with a specific l1Approval).

The CORE issue is: the Warehouse Assignment tab should be the ONLY place where admins assign warehouses to L1 approval records — meaning the Warehouse Assignments tab needs to:
1. Show all L1 approval records that have unassigned quantity (awaiting L2)
2. Allow admins to click "Assign Warehouse" on each L1 record from THIS tab
3. The Line Items tab should NOT show the "Assign WH" button (or it should not be the only entry point)

test: Read the Warehouse Assignments tab component and confirm it has no "Assign Warehouse" button, only "Execute" buttons for existing L2 assignments.
expecting: WarehouseAssignmentsTab shows only existing L2 assignments with Execute buttons, no way to add NEW assignments from there.
next_action: Fix: Add L1 approval records pending warehouse assignment to the Warehouse Assignments tab, with an "Assign Warehouse" button per L1 record. Remove or keep the Line Items tab "Assign WH" button based on requirements.

## Symptoms

expected: |
  1. Each L1 approval record should get its own warehouse assignment (per approval, not per line item)
  2. The Warehouse Assignment tab is the ONLY place where warehouses can be assigned
  3. Flow: Approval Qty tab -> approve quantities -> creates approval transaction -> moves to Warehouse Assignment tab -> assign warehouse PER APPROVAL RECORD -> creates transaction -> moves to Execute tab

actual: Warehouse is being assigned per line item instead of per individual approval record. The L2 warehouse assignment dialog/logic is scoped to the line item level rather than the approval level.

errors: No console errors - behavioral/data model issue

reproduction: Go to SOR execution page -> Warehouse Assignment tab -> try to assign warehouse -> it assigns per line item instead of per approval

started: Current implementation - recently built

## Eliminated

- hypothesis: "L2WarehouseDialog stores data keyed on line_item_id, not approval_id"
  evidence: The dialog correctly stores parent_approval_id and inserts L2 approvals with proper parent linkage. The DB schema is correct. The issue is purely in the UX flow/tab structure.
  timestamp: 2026-02-17

## Evidence

- timestamp: 2026-02-17
  checked: warehouse-assignments-tab.tsx
  found: The WarehouseAssignmentsTab only shows EXISTING L2 assignments grouped by line item, with Execute buttons. There is NO "Assign Warehouse" button on this tab. The tab header says "L2 warehouse assignments will appear here once an admin assigns approved quantities to warehouses" — but doesn't provide a way to do that FROM this tab.
  implication: Admins must go to the Line Items tab to trigger L2 assignment, which contradicts the requirement that the Warehouse Assignment tab is the ONLY assignment location.

- timestamp: 2026-02-17
  checked: line-item-table.tsx getRowAction()
  found: When item.status === 'awaiting_admin', it shows an "Assign WH" button that opens the L2WarehouseDialog with the first L1 approval that has remaining unassigned qty. The button is on the LINE ITEMS TAB ROW, not on the Warehouse Assignments tab.
  implication: This is the wrong place per requirements. The assignment entry point should be on the Warehouse Assignments tab, not the Line Items tab.

- timestamp: 2026-02-17
  checked: [id]/page.tsx
  found: The l2DialogState is set via onAssignWarehouse callback from LineItemTable. The Warehouse Assignments tab has no mechanism to open the L2 dialog. The tab shows completed L2 records (each with execute button) but no way to create new ones from that tab.
  implication: Need to add L1 approval records with pending assignment to the Warehouse Assignments tab, and add an "Assign Warehouse" button per L1 record.

- timestamp: 2026-02-17
  checked: DB schema (stock_out_approvals migration)
  found: The data model is correct: L1 (layer=quartermaster) approvals have no warehouse_id; L2 (layer=admin) approvals reference parent_approval_id -> L1 id with a warehouse_id. The L2WarehouseDialog correctly receives l1Approval.id and passes it as parent_approval_id.
  implication: No DB schema changes needed. The fix is purely in the UI: surface L1 approval records in the Warehouse Assignments tab.

## Resolution

root_cause: |
  The Warehouse Assignments tab (warehouse-assignments-tab.tsx) only shows existing L2 assignments (completed warehouse assignments) with "Execute" buttons. It provides NO mechanism to create new L2 warehouse assignments from that tab.

  The L2 warehouse assignment dialog is triggered ONLY from the Line Items tab via an "Assign WH" button per row. This violates the stated requirement that "The Warehouse Assignment tab is the ONLY place where warehouses can be assigned."

  Additionally, the "Assign WH" button in the Line Items tab is scoped per LINE ITEM (finding the first L1 approval with remaining qty), not per individual L1 APPROVAL RECORD. When a line item has multiple L1 approvals, only one can be processed at a time (first with remaining qty), and the L1 approval context is not visually shown to the user.

fix: |
  1. Redesign the WarehouseAssignmentsTab to show TWO sections:
     a. "Pending Assignment" section: L1 approval records with unassigned qty — each row has an "Assign Warehouse" button that opens L2WarehouseDialog
     b. "Assigned" section: L2 approval records (existing) — each row has "Execute" button (same as current)

  2. Add the necessary props/callbacks to WarehouseAssignmentsTab to pass L1 approval data and open the L2 dialog.

  3. Remove or repurpose the "Assign WH" button from the Line Items tab (or keep it as secondary access). Per requirements, warehouse assignment should ONLY be from the Warehouse Assignments tab.

  The [id]/page.tsx parent must:
     - Pass L1 approval data (from lineItems[].l1Approvals) to the Warehouse Assignments tab
     - Wire up the onAssignWarehouse callback to open the L2 dialog from the Warehouse Assignments tab

verification: |
  - TypeScript type-check: exit 0 (no errors)
  - ESLint: no new warnings in changed files
  - Logic: pendingL1Approvals computation uses same data already fetched, filtering only items with status=awaiting_admin and L1 approvals with remaining_to_assign > 0
  - Each PendingL1Approval maps to one L1 approval record (not one line item), satisfying the "per approval record" requirement
  - handleAssignWarehouseFromTab finds the full lineItem from state by line_item_id before opening L2 dialog — same data the dialog needs
  - Warehouse Assignments tab now has two sections: "Pending Assignment" and "Warehouse Assignments"
  - "Assign WH" button removed from Line Items tab; informational badge "Assign in WH tab" shown instead
files_changed:
  - components/stock-out-requests/warehouse-assignments-tab.tsx
  - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  - components/stock-out-requests/line-item-table.tsx
