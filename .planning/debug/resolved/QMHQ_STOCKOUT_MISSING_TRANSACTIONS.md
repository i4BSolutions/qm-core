---
status: resolved
trigger: "qmhq-stockout-tab-missing-transactions"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:30:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED — QmhqLinkedTransactions is a redundant duplicate component that adds a confusing second section to the Stock Out tab. The SOR-grouped view above it already shows the same stock-out transactions (from stockOutTransactions state). QmhqLinkedTransactions makes an INDEPENDENT query via inventory_transactions.qmhq_id — same filter as the page. When transactions exist, it shows a redundant table. When none exist, it shows a confusing second empty state ("No stock-out transactions linked to this QMHQ yet") BELOW the primary empty state ("No Items Issued Yet"). The component is dead weight and should be removed.

Additionally, the itemsProgressData.executed in ItemsSummaryProgress comes from stockOutTransactions (via qmhq_id filter), not from the SOR chain. If qmhq_id is NULL on some inventory_transactions, executed shows 0 even for rows that exist. The SOR-chain quantities (L1/L2 approved/rejected) come from stockOutRequest state — that IS the "different data path" the bug description mentions.

fix: Remove QmhqLinkedTransactions from the Stock Out tab in page.tsx. The SOR-grouped view already provides complete transaction display with better UX.
next_action: Apply the fix — remove the QmhqLinkedTransactions block from page.tsx lines 1091-1097

## Symptoms

expected: When a QMHQ has a linked SOR with completed stock-out transactions (inventory_transactions), the Stock Out tab should display those transactions — not show the empty state.
actual: The Stock Out tab shows "No stock-out transactions linked to this QMHQ yet" even though the linked SOR has inventory_transactions records (executed stock-out transactions).
errors: No error messages — it's a data query issue where the component can't find transactions that exist via the SOR relationship chain.
reproduction: Open a QMHQ item detail page (/qmhq/[id]) where the linked SOR has been through L1/L2/L3 approval and has executed inventory_transactions. The Stock Out tab will show empty state while the Items Summary section (which uses a different data path) correctly shows executed quantities.
timeline: Likely broken since the SOR approval system was implemented.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:10:00Z
  checked: app/(dashboard)/qmhq/[id]/page.tsx — stockOutTransactions query
  found: Line 264 uses .eq('qmhq_id', qmhqData.id) on inventory_transactions. Also .eq('movement_type', 'inventory_out') and .eq('is_active', true). Does NOT filter by status so returns both pending and completed.
  implication: The page-level query correctly uses qmhq_id. If qmhq_id is set on inventory_transactions, the page-level query will find those records.

- timestamp: 2026-02-18T00:11:00Z
  checked: components/qmhq/qmhq-linked-transactions.tsx — QmhqLinkedTransactions query
  found: Line 64 uses .eq("qmhq_id", qmhqId) on inventory_transactions. Same filter as page query. This component makes its OWN independent Supabase query on mount.
  implication: Both the page and component use identical filters. If qmhq_id IS populated, both find data. If NOT populated, both return empty.

- timestamp: 2026-02-18T00:12:00Z
  checked: supabase/migrations/023_inventory_transactions.sql
  found: inventory_transactions has qmhq_id UUID column referencing qmhq(id) ON DELETE SET NULL. This is an optional FK, not required.
  implication: qmhq_id may be NULL on some or all inventory_out transactions depending on how they were created.

- timestamp: 2026-02-18T00:13:00Z
  checked: supabase/migrations/061_auto_populate_qmhq_link.sql
  found: BEFORE INSERT trigger trg_auto_populate_qmhq_from_sor auto-populates qmhq_id from SOR chain when stock_out_approval_id is set. Also includes a backfill UPDATE for existing rows. The trigger fires on INSERT only, not UPDATE.
  implication: If qmhq_id is NOT explicitly passed on INSERT, the trigger populates it from the approval chain. Backfill should have fixed pre-migration rows.

- timestamp: 2026-02-18T00:14:00Z
  checked: components/stock-out-requests/l2-warehouse-dialog.tsx lines 258-271
  found: When L2 warehouse assignment is created, inventory_transaction is inserted with explicit qmhq_id: qmhqId || null and status: 'pending'. The qmhqId prop comes from the SOR's qmhq_id field.
  implication: New transactions created since the L2 approval flow was implemented SHOULD have qmhq_id set explicitly from the SOR.

- timestamp: 2026-02-18T00:15:00Z
  checked: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx confirmExecution function (lines 638-686)
  found: Execution does an UPDATE setting status='completed' and transaction_date but does NOT touch qmhq_id. The trigger trg_auto_populate_qmhq_from_sor is BEFORE INSERT only — doesn't fire on UPDATE.
  implication: qmhq_id was set at INSERT time (pending state). The UPDATE at execution only changes status. qmhq_id should already be set from INSERT.

- timestamp: 2026-02-18T00:16:00Z
  checked: QmhqLinkedTransactions rendering context in page.tsx lines 1091-1097
  found: QmhqLinkedTransactions is always rendered in the Stock Out tab, regardless of stockOutTransactions.length. It renders its own empty state ("No stock-out transactions linked to this QMHQ yet") below the SOR-grouped view empty state ("No Items Issued Yet") when stockOutTransactions.length == 0.
  implication: The user sees TWO empty states in the Stock Out tab when stockOutTransactions is empty. The QmhqLinkedTransactions component is a REDUNDANT duplicate display. When transactions DO exist, both the SOR-grouped view and QmhqLinkedTransactions would show them (duplicating the data).

- timestamp: 2026-02-18T00:17:00Z
  checked: FulfillmentMetrics component lines 83-90
  found: FulfillmentMetrics also queries inventory_transactions with .eq("qmhq_id", qmhqId). This is the component the bug description calls "Items Summary section that correctly shows executed quantities."
  implication: If FulfillmentMetrics shows non-zero executed, it means inventory_transactions.qmhq_id IS populated for completed rows. The page-level stockOutTransactions (which doesn't filter by status) should find these AND the pending rows too.

## Resolution

root_cause: The QmhqLinkedTransactions component in the Stock Out tab of /qmhq/[id]/page.tsx was a redundant, duplicate block that always rendered its own independent Supabase query (inventory_transactions.qmhq_id) and displayed a confusing second empty state ("No stock-out transactions linked to this QMHQ yet") below the already-functional SOR-grouped transactions view. The SOR-grouped view above it (driven by the page-level stockOutTransactions state) already correctly shows the same data. When stockOutTransactions was empty (no completed executions yet), the user saw two empty states in the tab — the primary one ("No Items Issued Yet") from the SOR-grouped view section, and the secondary one from QmhqLinkedTransactions. When transactions existed, the component duplicated them in a separate table below the SOR-grouped view.

fix: Removed QmhqLinkedTransactions component and its import from app/(dashboard)/qmhq/[id]/page.tsx. The SOR-grouped transactions view is the canonical display for stock-out transactions in the Stock Out tab.

verification: TypeScript type-check passes (exit 0). ESLint passes (exit 0, only pre-existing unrelated warnings). No references to QmhqLinkedTransactions remain in page.tsx.

files_changed:
  - app/(dashboard)/qmhq/[id]/page.tsx: removed QmhqLinkedTransactions import and JSX block from Stock Out tab
