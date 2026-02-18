---
status: resolved
trigger: "qmhq-stockout-tab-empty-state — Stock Out tab shows empty state even though SOR data exists"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. The root cause is that QmhqLinkedTransactions component (rendered below the main SOR content) has its own empty-state message "No stock-out transactions linked to this QMHQ yet" that always shows when no inventory_transactions exist — even when SOR approvals exist at L1/L2 stage.
test: N/A — root cause confirmed by code reading
expecting: N/A
next_action: Fix QmhqLinkedTransactions to accept hasPendingSor prop and show contextual message; also fix tab badge count to include SOR line items not just inventory_transactions

## Symptoms

expected: Stock Out tab displays SOR-based stock-out data (L1 approved, L2 warehouse assigned, L3 executed) from the same data the Items Summary shows
actual: Stock Out tab shows "No stock-out transactions linked to this QMHQ yet" empty state
errors: None — just wrong data source / empty state
reproduction: Open any QMHQ item detail page with route_type='item' that has stock-out requests with approvals
started: Stock Out tab was built before the 3-layer SOR system; Items Summary was updated in commit 0db4d84 but Stock Out tab was never updated

## Eliminated

(none)

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: app/(dashboard)/qmhq/[id]/page.tsx lines 1024-1094 (Stock Out tab)
  found: The tab has two distinct sections: (1) SOR-grouped transactions based on stockOutTransactions state, (2) QmhqLinkedTransactions component rendered unconditionally at the bottom
  implication: The QmhqLinkedTransactions component always renders and always shows its own empty state when no inventory_transactions exist

- timestamp: 2026-02-18T00:01:30Z
  checked: components/qmhq/qmhq-linked-transactions.tsx lines 88-99
  found: Empty state text "No stock-out transactions linked to this QMHQ yet" is shown whenever transactions.length === 0, with no awareness of whether a SOR exists
  implication: This is the exact text the user sees — and it's always shown when SOR is at L1/L2 stage (before any inventory_transactions are created)

- timestamp: 2026-02-18T00:02:00Z
  checked: page.tsx line 773 — tab badge count
  found: Tab shows "Stock Out ({stockOutTransactions.length})" — this is always 0 until L3 execution, even if SOR has L1/L2 approvals
  implication: Tab badge also misrepresents state — should reflect SOR activity

- timestamp: 2026-02-18T00:02:30Z
  checked: page.tsx lines 1051-1069 — upper section empty state
  found: Upper section also shows "No Items Issued Yet" when stockOutTransactions.length === 0, but it's inside a panel that already shows ItemsSummaryProgress above it — so this is less critical
  implication: The main visible empty state is the QmhqLinkedTransactions component at the bottom

## Resolution

root_cause: The QmhqLinkedTransactions component at the bottom of the Stock Out tab has its own empty state ("No stock-out transactions linked to this QMHQ yet") that it displays whenever no inventory_transactions exist via direct qmhq_id FK. It has no awareness of the SOR approval chain, so it always shows empty during L1 and L2 stages even though SOR data exists. Additionally, the tab badge count uses stockOutTransactions.length (inventory transactions) rather than reflecting SOR activity. The upper empty state inside the main panel also showed "No Items Issued Yet" without acknowledging the in-progress SOR.
fix: |
  Three changes applied:
  1. components/qmhq/qmhq-linked-transactions.tsx: Added hasPendingSor prop. When true and transactions are empty, shows "Awaiting Execution" with contextual message instead of generic empty state.
  2. app/(dashboard)/qmhq/[id]/page.tsx: Tab trigger badge now shows SOR line item count when no inventory_transactions exist, falling back to 0 when no SOR at all.
  3. app/(dashboard)/qmhq/[id]/page.tsx: Upper panel empty state now shows "Awaiting Execution" with a link to the SOR when stockOutRequest exists, instead of generic "No Items Issued Yet" message.
verification: TypeScript type-check passes (exit 0). ESLint shows only pre-existing warnings, no new errors. All three empty state scenarios correctly handled: (a) no SOR → shows original empty + Request button, (b) SOR in progress (L1/L2) → shows contextual awaiting message, (c) SOR executed (L3) → shows actual transaction data.
files_changed:
  - components/qmhq/qmhq-linked-transactions.tsx
  - app/(dashboard)/qmhq/[id]/page.tsx
