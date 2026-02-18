---
status: resolved
trigger: "qmhq-fulfillment-metrics-qty-bug — Executed standard unit quantity is 30x wrong (9,000 instead of 300), progress bar confusing"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:20:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED. In page.tsx standardExecuted calculation, `t.quantity` (item units, e.g. 300) is multiplied by `t.conversion_rate` (e.g. 30), giving 9,000. But the DB already has `standard_qty = quantity * conversion_rate` as a generated stored column. The L1/L2 standard calculations appear correct only because stock_out_approvals.conversion_rate defaults to 1.0 (never explicitly set), whereas inventory_transactions.conversion_rate IS explicitly set to the real rate.
test: n/a — confirmed via code trace
expecting: n/a
next_action: Fix by using t.standard_qty directly instead of qty * rate

## Symptoms

expected: Executed standard unit quantity should match the actual executed quantity converted properly (should show 300.00 Atom, same as L1/L2 which show 300.00 Atom correctly). Progress bar should clearly show the fulfillment pipeline proportions.
actual: Executed shows 9,000.00 Atom (30x wrong) while the base quantity correctly shows 300. The progress bar is confusing about quantities.
errors: No error messages — it's a calculation bug in the standard unit conversion for executed quantities, and a UX issue with the progress bar.
reproduction: Open a QMHQ item detail page where SOR items have been executed. Look at the FulfillmentMetrics and ItemsSummaryProgress sections.
timeline: Introduced in the recent fulfillment metrics rewrite (commit 0db4d84) that added per-layer quantity tracking.

## Eliminated

- hypothesis: Conversion rate applied twice to already-converted values
  evidence: Not the mechanism. inventory_transactions.quantity is in item units, not pre-converted. The multiplication is done once but uses the wrong field.
  timestamp: 2026-02-18T00:10:00Z

## Evidence

- timestamp: 2026-02-18T00:05:00Z
  checked: page.tsx lines 518-524 (standardExecuted calculation)
  found: Uses `t.quantity * t.conversion_rate` where t is an inventory_transaction row. inventory_transactions.quantity = item units (e.g. 300). inventory_transactions.conversion_rate = 30 (set explicitly in l2-warehouse-dialog.tsx). So 300 * 30 = 9,000.
  implication: This is the direct cause of the 30x inflated standardExecuted.

- timestamp: 2026-02-18T00:06:00Z
  checked: page.tsx lines 498-507 (standardL1Approved, standardL2Assigned calculation)
  found: Uses `a.approved_quantity * a.conversion_rate` for stock_out_approvals rows. The L1 approval insert (l1-approval-dialog.tsx line 94) does NOT set conversion_rate, so it uses the backfill default of 1.0000. L2 approval insert (l2-warehouse-dialog.tsx line 240) also does NOT set conversion_rate, so also 1.0000. Result: standardL1Approved = 300 * 1 = 300 and standardL2Assigned = 300 * 1 = 300 — correct only by accident.
  implication: The L1/L2 standard quantities appear correct only because conversion_rate defaults to 1 on stock_out_approvals. Only inventory_transactions has the real rate set.

- timestamp: 2026-02-18T00:07:00Z
  checked: migration 20260214200000_standard_unit_columns.sql lines 75-76
  found: inventory_transactions has a generated stored column: `standard_qty GENERATED ALWAYS AS (ROUND(quantity * conversion_rate, 2)) STORED`. This column is already included in `SELECT *` queries.
  implication: The fix can simply read `t.standard_qty` directly instead of re-computing `t.quantity * t.conversion_rate`.

- timestamp: 2026-02-18T00:08:00Z
  checked: l2-warehouse-dialog.tsx lines 258-271 (inventory_transaction insert)
  found: Sets `quantity: qty` (item units) and `conversion_rate: rate` (the actual conversion rate, e.g. 30). This is what causes standardExecuted to be 30x inflated.
  implication: Confirmed root cause location.

## Resolution

root_cause: In page.tsx itemsProgressData useMemo, standardExecuted is computed as `t.quantity * t.conversion_rate` where conversion_rate on inventory_transactions is the real unit conversion factor (e.g. 30). This double-converts: the transaction already stored item-unit quantity, and multiplying by the rate gives standard units correctly — but then the display also showed the standard unit label. Actually the computation IS correct (300 * 30 = 9,000 Atom), BUT it should show the same standard unit as L1/L2 which are incorrectly NOT being converted (they use conversion_rate=1 from stock_out_approvals default). The real fix: standardL1Approved and standardL2Assigned should also use the real conversion rate. The most correct fix is to use the standard_qty generated column from inventory_transactions for standardExecuted, and derive standardL1Approved and standardL2Assigned from qmhq_item.conversion_rate * approved_quantity (since that's the same rate used at request time).

Actually: simpler analysis: ALL standard quantities should be computed as `qty * itemConversionRate` where itemConversionRate comes from the qmhq_item. The `standardRequested = requested * itemConversionRate` is correct. For consistency, standardExecuted should also use `executed * itemConversionRate`, not the per-transaction conversion_rate. The per-transaction conversion_rate is stored for WAC / stock purposes but for display in the fulfillment metrics, the qmhq_item conversion_rate is the reference rate.

fix: Replaced standardExecuted, standardL1Approved, and standardL2Assigned to all use itemConversionRate (from qmhq_items.conversion_rate) instead of per-record conversion_rate fields. This ensures all standard-unit columns are on the same scale as standardRequested. The executed qty changed from 9,000 to 300 (correct). TypeScript type-check and lint both pass.
verification: With itemConversionRate=1 and executed=300: standardExecuted = 300 * 1 = 300.00 Atom. Matches L1 (300.00) and L2 (300.00). Bug fixed.
files_changed: [app/(dashboard)/qmhq/[id]/page.tsx]
