---
phase: 39-end-to-end-flow-tracking
plan: 01
subsystem: flow-tracking
tags: [database, view, queries, types, data-layer]
dependency_graph:
  requires: [qmrl, qmhq, purchase_orders, invoices, inventory_transactions, financial_transactions, stock_out_requests]
  provides: [qmrl_flow_chain VIEW, FlowChain types, fetchFlowChain query]
  affects: []
tech_stack:
  added: [PostgreSQL VIEW, TypeScript interfaces]
  patterns: [LEFT JOIN chain, Map-based deduplication, row-to-tree transformation]
key_files:
  created:
    - supabase/migrations/20260211140000_flow_tracking_view.sql
    - types/flow-tracking.ts
    - lib/supabase/flow-tracking-queries.ts
  modified: []
decisions:
  - decision: "Use PostgreSQL VIEW instead of materialized view for real-time data access"
    rationale: "Flow tracking requires current data; assumes <10K QMRLs for acceptable performance"
  - decision: "Flat row output from VIEW with Map-based transformation in TypeScript"
    rationale: "Simpler SQL (no JSON aggregation), O(1) deduplication in application layer"
  - decision: "Do not enable RLS on VIEW, enforce admin-only access in page component (Plan 02)"
    rationale: "PostgreSQL VIEWs don't support RLS directly; underlying table RLS inherited via security_invoker = false"
  - decision: "Include voided invoices and cancelled POs in VIEW results"
    rationale: "User constraint: visible for audit trail; UI will style them appropriately (strikethrough/grey)"
metrics:
  duration: 187s
  tasks_completed: 2
  files_created: 3
  commits: 2
  lines_added: 668
completed_date: 2026-02-11
---

# Phase 39 Plan 01: Flow Tracking Data Layer Summary

**One-liner:** PostgreSQL VIEW qmrl_flow_chain with multi-level LEFT JOINs, TypeScript nested chain types, and fetchFlowChain query with Map-based row-to-tree transformation

## What Was Built

Created the data foundation for end-to-end flow tracking: a PostgreSQL VIEW that joins the full QMRL downstream chain (QMRL -> QMHQs -> POs -> Invoices -> Stock + Financial Transactions + Stock-Out Requests), TypeScript types modeling the nested structure, and a query function that fetches and transforms flat VIEW rows into a nested tree.

### Deliverables

1. **PostgreSQL VIEW Migration** (`supabase/migrations/20260211140000_flow_tracking_view.sql`)
   - CREATE VIEW qmrl_flow_chain with 7-level LEFT JOIN chain
   - Joins: QMRL -> status_config + users (requester, assigned_to) + contact_persons
   - Joins: QMHQ -> status_config + users (assigned_to) + contact_persons
   - Joins: purchase_orders -> suppliers
   - Joins: invoices (child of PO)
   - Joins: inventory_transactions (via invoice_id OR qmhq_id)
   - Joins: financial_transactions (via qmhq_id)
   - Joins: stock_out_requests (via qmhq_id)
   - WHERE clause: qmrl.is_active = true
   - ORDER BY: qmrl.created_at DESC, qmhq.created_at, po.po_date, invoice.invoice_date
   - GRANT SELECT ON qmrl_flow_chain TO authenticated

2. **TypeScript Types** (`types/flow-tracking.ts`)
   - FlowPerson: { id, full_name, avatar_url } for user display
   - FlowStatus: { name, color } for status badge rendering
   - FlowStockTransaction: inventory transaction details
   - FlowFinancialTransaction: financial transaction details
   - FlowStockOutRequest: stock-out request details
   - FlowInvoice: invoice with stock_transactions array
   - FlowPO: PO with invoices array, is_cancelled flag
   - FlowQMHQ: QMHQ with route-specific children (pos, financial_transactions, stock_transactions, stock_out_requests)
   - FlowQMRL: root entity with qmhqs array
   - FlowChain: type alias for FlowQMRL

3. **Query Function** (`lib/supabase/flow-tracking-queries.ts`)
   - fetchFlowChain(supabase, qmrlRequestId) -> { data: FlowChain | null; error: string | null }
   - Normalizes request ID (uppercase, trim)
   - Queries qmrl_flow_chain VIEW
   - Transforms flat rows into nested tree using Map-based deduplication
   - O(1) entity grouping: qmhqMap, poMap, invoiceMap
   - Route-specific nesting logic:
     - PO route: pos -> invoices -> stock_transactions
     - Expense route: financial_transactions
     - Item route: stock_transactions, stock_out_requests
   - Edge cases handled: QMRL with zero QMHQs, NULL statuses (default "Unknown"), voided invoices, cancelled POs
   - Returns null data (not error) for not-found QMRL IDs

## Technical Implementation

### VIEW Structure

The VIEW returns flat rows with many NULL columns due to LEFT JOINs. Each row contains:
- QMRL fields (always populated)
- QMHQ fields (NULL if QMRL has no QMHQs)
- PO fields (NULL if QMHQ is not PO route or has no POs)
- Invoice fields (NULL if PO has no invoices)
- Stock transaction fields (NULL if no stock transactions)
- Financial transaction fields (NULL if QMHQ is not expense route)
- Stock-out request fields (NULL if QMHQ is not item route)

### Transformation Algorithm

```
1. Extract QMRL data from first row (all rows have same QMRL)
2. For each row:
   a. If qmhq_id exists and not in qmhqMap, create FlowQMHQ and add to map
   b. If po_id exists and not in current QMHQ's pos array, create FlowPO and add
   c. If invoice_id exists and not in current PO's invoices array, create FlowInvoice and add
   d. If stock_id exists and not already added:
      - Add to invoice.stock_transactions (if invoice_id matches, for PO route stock-in)
      - Add to qmhq.stock_transactions (if qmhq route is 'item', for item route stock-out)
   e. If ft_id exists and not already added, add to qmhq.financial_transactions
   f. If sor_id exists and not already added, add to qmhq.stock_out_requests
3. Assemble: qmrl.qmhqs = Array.from(qmhqMap.values())
```

### Key Design Decisions

**Why VIEW instead of materialized view?**
- Flow tracking requires real-time data (not stale snapshot)
- Assumes <10K QMRLs for acceptable query performance
- If performance becomes an issue at scale, can migrate to materialized view with refresh strategy

**Why flat rows + TypeScript transformation instead of PostgreSQL JSON aggregation?**
- Simpler SQL (no complex json_agg with nested joins)
- More maintainable transformation logic in application layer
- O(1) Map-based deduplication is efficient for typical chain sizes

**Why no RLS on VIEW?**
- PostgreSQL VIEWs don't support RLS policies directly
- VIEW uses security_invoker = false (default), so it inherits underlying table RLS from caller's session
- Admin-only access enforced at page component level (Plan 02)

## Verification Results

✓ `npm run type-check` passes with no errors
✓ Migration file syntactically valid SQL
✓ types/flow-tracking.ts exports all required interfaces (9 types exported)
✓ lib/supabase/flow-tracking-queries.ts exports fetchFlowChain
✓ Transformation logic handles all edge cases (zero QMHQs, NULL statuses, voided/cancelled entities)

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Consumed by:**
- Flow tracking page UI (Phase 39 Plan 02) - will use fetchFlowChain to load and display chain

**Depends on:**
- Existing schema migrations: 009_qmrl, 011_qmhq, 015_purchase_orders, 021_invoices, 023_inventory_transactions, 012_financial_transactions, 052_stock_out_requests
- Supabase client: lib/supabase/server.ts (for server-side queries)

## Performance Considerations

**Current assumptions:**
- <10K QMRLs in production
- Typical chain depth: QMRL -> 3 QMHQs -> 2 POs -> 3 Invoices (moderate branching)

**Optimization strategies if performance degrades:**
1. Add indexes on JOIN columns (already exist: qmhq.qmrl_id, po.qmhq_id, invoice.po_id, inv_trans.invoice_id/qmhq_id, fin_trans.qmhq_id, sor.qmhq_id)
2. Migrate to materialized view with incremental refresh on INSERT/UPDATE/DELETE triggers
3. Add pagination to flow tracking page (load 1 QMRL at a time)

## Next Steps

**Immediate (Plan 02):**
- Create flow tracking page UI at /admin/flow-tracking
- Add QMRL request_id search input
- Render nested chain using card-based layout (no React Flow library needed for linear chain)
- Admin-only access enforcement via server-side layout guard

**Future enhancements:**
- Add export to PDF/Excel functionality
- Add timeline view mode (chronological vs. hierarchical)
- Add filtering by date range, status, route type

## Self-Check: PASSED

✓ Migration file exists at supabase/migrations/20260211140000_flow_tracking_view.sql
✓ Types file exists at types/flow-tracking.ts
✓ Query file exists at lib/supabase/flow-tracking-queries.ts
✓ Task 1 commit exists: bddfd73
✓ Task 2 commit exists: 86b3015
✓ All files compile without TypeScript errors
✓ All exported functions/types verified present
