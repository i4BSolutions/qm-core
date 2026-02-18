---
status: resolved
trigger: "qmhq-detail-remove-redundant-stockout-section"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED. The redundant section is a full "Stock Out" tab (value="stock-out") visible in the TabsList for all item-route QMHQs. It contains an ItemsSummaryProgress duplicate AND an empty state ("No Items Issued Yet" / "Stock-out transactions will appear here..."). The Details tab already renders FulfillmentMetrics + ItemsSummaryProgress at lines 942-958. The entire Stock Out tab is the redundant section.
test: N/A - root cause confirmed via direct code reading.
expecting: N/A
next_action: Remove the Stock Out tab trigger from TabsList AND remove the entire TabsContent value="stock-out" block (lines 1024-1095). Also clean up unused state and data fetching if they are only used by that tab.

## Symptoms

expected: The QMHQ detail page for item-route QMHQs should NOT show a separate "No stock-out transactions linked to this QMHQ yet" section, since stock-out fulfillment data is already displayed in the Items Summary section (via FulfillmentMetrics and ItemsSummaryProgress components that show L1 approved, L2 assigned, and executed quantities from SOR).
actual: The page shows a redundant "No stock-out transactions linked to this QMHQ yet" empty state message, cluttering the UI when the same data is already covered by Items Summary.
errors: No errors — this is a UI cleanup issue (remove redundant section).
reproduction: Open any QMHQ item detail page (/qmhq/[id]) with route_type='item'.
started: Section became redundant when Items Summary was updated to show per-layer fulfillment data from the SOR approval system (commit 0db4d84).

## Eliminated

[]

## Evidence

- timestamp: 2026-02-18T00:02:00Z
  checked: app/(dashboard)/qmhq/[id]/page.tsx - full file read
  found: A dedicated "Stock Out" tab (TabsTrigger value="stock-out", TabsContent value="stock-out") existed in the tabs system for all item-route QMHQs. It showed an ItemsSummaryProgress duplicate and an empty state message "No Items Issued Yet / Stock-out transactions will appear here...". The Details tab already has FulfillmentMetrics (line 870) and ItemsSummaryProgress (line 879) rendering the same data.
  implication: The Stock Out tab and its empty state are entirely redundant. Also found two unused memos (allItemsFullyIssued, sorGroupedTransactions) and two unused imports (SORTransactionGroup, QmhqLinkedTransactions) that existed only to support the removed tab.

## Resolution

root_cause: A "Stock Out" tab was added to the QMHQ detail page for item-route QMHQs before the Details tab was updated to include FulfillmentMetrics and ItemsSummaryProgress. Once the Details tab was updated (commit 0db4d84) to show per-layer fulfillment data from the SOR approval system, the Stock Out tab became fully redundant, showing the same data plus an empty state that confused users.
fix: Removed the Stock Out tab trigger from TabsList, removed the entire TabsContent block for value="stock-out" (~72 lines), removed two now-unused useMemo hooks (allItemsFullyIssued, sorGroupedTransactions), and removed two now-unused imports (SORTransactionGroup, QmhqLinkedTransactions, ArrowUpFromLine). The underlying data-fetching for stockOutTransactions and stockOutRequest was retained as it still powers itemsProgressData used by the Details tab.
verification: TypeScript type-check passes with zero errors. Items Summary / FulfillmentMetrics in the Details tab are intact and unmodified.
files_changed:
  - app/(dashboard)/qmhq/[id]/page.tsx
