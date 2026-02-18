---
status: resolved
trigger: "QMHQ item detail page - the Fulfillment and Items Summary matrix should show per-layer quantities (L1 approved, L2 warehouse assigned, L3 executed) since the 3-layer approval system is implemented."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - The QMHQ detail page computes "approved" qty by summing ALL approvals with decision='approved' regardless of layer. This means L1 (quartermaster) and L2 (admin) approvals are both summed together into the "Approved" column. The FulfillmentMetrics component has the same issue. Neither component differentiates L1 vs L2 quantities. The ItemsSummaryProgress shows Requested/Approved/Executed but should show Requested/L1 Approved/L2 Assigned/Executed as four distinct layers.
test: Code inspection complete — confirmed both code paths
expecting: n/a - root cause found
next_action: Fix the itemsProgressData computation in qmhq/[id]/page.tsx and the FulfillmentMetrics component to properly separate L1 vs L2 approvals

## Symptoms

expected: The Fulfillment and Items Summary matrix on QMHQ item detail page should display L1 approved qty, L2 assigned qty (with warehouse), and L3 executed qty separately — reflecting the 3-layer stock-out approval system built in v1.12 phases 55-57.
actual: Shows incorrect totals — numbers don't match what's actually been approved/assigned/executed through the L1/L2/L3 approval layers.
errors: No error messages — data correctness / UI completeness issue.
reproduction: Open any QMHQ item detail page (/qmhq/[id]) for an item-route QMHQ that has stock-out requests with L1/L2/L3 approvals.
started: The 3-layer approval system was built in v1.12 (phases 55-57) but the QMHQ item detail page predates this and was never updated.

## Eliminated

- hypothesis: The UI is reading from wrong table or wrong QMHQ ID
  evidence: The query joins are correct and scoped to the right qmhq_id; the data source is fine
  timestamp: 2026-02-18T00:10:00Z

- hypothesis: The issue is in the FulfillmentProgressBar component
  evidence: The FulfillmentProgressBar is not used for the matrix display — ItemsSummaryProgress and FulfillmentMetrics are
  timestamp: 2026-02-18T00:10:00Z

## Evidence

- timestamp: 2026-02-18T00:05:00Z
  checked: app/(dashboard)/qmhq/[id]/page.tsx itemsProgressData useMemo (lines 470-528)
  found: "approved" quantity is calculated by summing approvals where decision='approved' without filtering by layer. Both L1 (quartermaster) and L2 (admin) approvals are summed together. The SOR data fetched in fetchData (lines 273-286) only fetches `approvals:stock_out_approvals(approved_quantity, decision)` — no layer column is fetched at all.
  implication: "Approved" column shows L1+L2 combined, not L1 only. L2 warehouse assignment qty is not shown separately.

- timestamp: 2026-02-18T00:06:00Z
  checked: components/qmhq/fulfillment-metrics.tsx (lines 27-97)
  found: FulfillmentMetrics computes "approved" by summing all approvals with decision='approved' from line_items.approvals, no layer filtering. Shows only 4 columns: Requested, Approved, Rejected, Executed. No L1/L2 distinction.
  implication: The "Approved" KPI card shows L1+L2 combined (incorrect). Should show L1 (quartermaster approved) and L2 (admin warehouse-assigned) separately.

- timestamp: 2026-02-18T00:07:00Z
  checked: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx (lines 303-380)
  found: The SOR detail page correctly computes L1 (quartermaster layer) and L2 (admin layer) quantities separately. Uses `a.layer === 'quartermaster'` and `a.layer === 'admin'` filters. This is the reference implementation we should follow.
  implication: The fix for QMHQ detail should mirror the SOR detail page's layer-aware computation logic.

- timestamp: 2026-02-18T00:08:00Z
  checked: ItemProgressData interface in components/qmhq/items-summary-progress.tsx (lines 3-15)
  found: Interface only has: requested, approved, executed, rejected, standardRequested, standardApproved, standardExecuted. No l2AssignedQuantity or l1ApprovedQuantity fields. Display shows Requested/Approved/Executed/Rejected.
  implication: Both the interface and the display component need new L2 fields added. The progress bar and legend need to show a 4th layer for L2 warehouse assignment.

- timestamp: 2026-02-18T00:09:00Z
  checked: qmhq/[id]/page.tsx StockOutRequest type and the sorDataArray query (lines 273-286)
  found: The stock_out_requests query fetches `approvals:stock_out_approvals(approved_quantity, decision)` — the `layer` and `warehouse_id` columns are NOT fetched. This means the layer information is unavailable to the itemsProgressData computation.
  implication: The query must be extended to include `layer` in the approvals selection. This is the root cause of why L1/L2 cannot be distinguished.

## Resolution

root_cause: Three compounding issues: (1) The sorDataArray query in qmhq/[id]/page.tsx fetched approvals without the `layer` column, making L1/L2 indistinguishable. (2) itemsProgressData useMemo summed ALL approved decisions together (L1+L2 conflated into one "Approved" bucket). (3) FulfillmentMetrics had the same layer-blind aggregation, showing a combined "Approved" KPI instead of separate L1/L2 values. None of the display components reflected the 3-layer approval model built in v1.12 phases 55-57.

fix: |
  1. Extended the sorDataArray Supabase query to include `layer`, `warehouse_id`, `parent_approval_id`, `conversion_rate` columns from stock_out_approvals.
  2. Rewrote itemsProgressData useMemo to use layer-aware filtering: l1Approved (layer='quartermaster'), l2Assigned (layer='admin'), rejected — each computed separately. Added standardL2Assigned for standard unit display.
  3. Added `l2Assigned` and `standardL2Assigned` fields to ItemProgressData interface.
  4. Rewrote ItemsSummaryProgress to show 4-layer stepped progress bar (slate=requested, blue=L1, purple=L2, emerald=executed) plus distinct legend entries for each layer including "Awaiting Assignment" and "Awaiting Execution" pending states.
  5. Rewrote FulfillmentMetrics to fetch `layer` from approvals, compute l1Approved/l2Assigned/rejected separately, and display as 5 KPI columns: Requested / L1 Approved / L2 Assigned / Rejected / Executed.

verification: TypeScript type check passes (exit code 0). Lint shows only pre-existing warnings, none introduced by this change.
files_changed:
  - app/(dashboard)/qmhq/[id]/page.tsx
  - components/qmhq/items-summary-progress.tsx
  - components/qmhq/fulfillment-metrics.tsx
