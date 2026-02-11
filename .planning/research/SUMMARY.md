# Project Research Summary

**Project:** v1.7 Stock-Out Execution Logic Repair
**Domain:** Internal inventory management system (QM System)
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

The v1.7 milestone repairs the stock-out execution logic by shifting from request-level atomic execution to per-line-item granular execution. Research confirms that no new technology stack is required—the existing Next.js 14, Supabase PostgreSQL, and React 18 infrastructure fully supports the changes. The fix requires three integration layers: (1) execution model shift from batch to line-item-level, (2) QMHQ linking through FK propagation, and (3) dual reference display (SOR + QMHQ) in transaction records.

The recommended approach leverages existing patterns: the FK `qmhq_id` already exists in `inventory_transactions` (migration 023), status computation triggers already aggregate by line_item_id, and the codebase already implements per-row action patterns (approval dialogs). The core work is refactoring UI components to accept `lineItemId` scoping, adding QMHQ reference propagation logic during approval creation, and implementing dual reference rendering components.

Critical risks center on multi-level status aggregation timing (3-level cascade: transactions → line_items → requests), transaction linking integrity (orphaned records if FK not populated), and concurrent execution race conditions (stock depletion conflicts). Mitigation strategies include row-level locking in status triggers, validation triggers requiring valid FK links, advisory locks for stock validation, and idempotency constraints to prevent duplicate execution.

## Key Findings

### Recommended Stack

**Zero new dependencies required.** The existing stack provides all necessary capabilities:

**Core technologies:**
- **Next.js 14.2.13 (App Router)**: Server components and client components sufficient for per-line action handlers — no state management library needed
- **PostgreSQL via Supabase**: Existing FK `qmhq_id` in `inventory_transactions` (migration 023) supports dual linking; triggers already handle per-line-item status aggregation
- **React 18.3.1**: `useState` and `useEffect` adequate for execution dialog scoping; no additional libraries required
- **Radix UI + Tailwind CSS**: Existing Dialog, Tooltip, Link components reusable for dual reference display with conditional rendering

**What changes (logic only, no new libraries):**
- `ExecutionDialog` component: Accept optional `lineItemId` prop, filter queries by line item
- Approval creation logic: Propagate `stock_out_requests.qmhq_id` → `inventory_transactions.qmhq_id`
- Transaction display: Conditional rendering shows "SOR-YYYY-NNNNN (via QMHQ-YYYY-NNNNN)" with links

**Source quality:** HIGH — All capabilities verified in existing codebase (migrations 023, 052, 053, components, package.json)

### Expected Features

**Must have (table stakes):**
- **Per-line-item execution UI** — Execute button per approved line item (not just request-level batch)
- **QMHQ transaction visibility** — QMHQ detail page shows stock-out transactions from linked SORs
- **Dual reference traceability** — Transaction records show both SOR approval number AND parent QMHQ number
- **Status accuracy** — Line item status reflects per-line execution (partially_executed when only some approvals executed)
- **Stock validation** — Cannot execute if warehouse stock insufficient at execution time

**Should have (differentiators):**
- **Request-level execution fallback** — Keep "Execute All" button for bulk operations (optional, power user feature)
- **Execution history granularity** — Audit logs track which line item was executed when (selective logging to prevent explosion)

**Defer (v2+):**
- **Execution scheduling** — Auto-execute at scheduled time
- **Execution approval** — Two-step execution (propose + confirm by different user)
- **Warehouse selection at execution** — Override approval warehouse during execution
- **Partial quantity execution** — Execute less than approved quantity

### Architecture Approach

The existing architecture uses approval-level pending transactions with batch execution through an RPC-style pattern. The new architecture shifts execution granularity to line-item-level while preserving the same data flow: approval creation populates `inventory_transactions` with `status='pending'`, execution updates status to `completed`, triggers compute line item and request statuses from aggregated transactions.

**Major components:**

1. **LineItemExecutionDialog** (NEW) — Scoped execution dialog that filters pending transactions by `lineItemId`, displays approvals for that line only, executes subset of transactions
2. **QMHQ Reference Propagation** (LOGIC CHANGE) — Approval creation fetches `stock_out_requests.qmhq_id`, copies to `inventory_transactions.qmhq_id` for dual linking
3. **TransactionReference Component** (NEW) — Parses `reference_no` field ("SOR-2026-00001 (QMHQ: QMHQ-2026-00042)"), renders clickable links to both SOR and QMHQ detail pages
4. **Status Computation Triggers** (ENHANCEMENT) — Add row-level locking (`FOR UPDATE` on parent request) to serialize status recomputation during concurrent executions

**Integration pattern:** Option A (Copy qmhq_id during approval) chosen over JOIN query or database view because it maintains existing direct FK filter pattern, requires no schema migration, and optimizes query performance with indexed FK lookup.

### Critical Pitfalls

1. **Stale Parent Status from Trigger Race Conditions** — Multiple line items executing concurrently fire status computation triggers in rapid succession; parent request status aggregation query reads partial child state. **Prevention:** Add row-level locking (`PERFORM 1 FROM stock_out_requests WHERE id = parent_id FOR UPDATE`) in `compute_sor_request_status()` to serialize status computation. Add trigger on `stock_out_line_items` table itself to propagate direct status updates (not just from transactions).

2. **Orphaned Inventory Transactions from Missing FK Link** — Per-line execution UI passes `lineItemId`, but transaction creation forgets to set `stock_out_approval_id`, breaking lineage chain and preventing status rollup. **Prevention:** Add BEFORE INSERT validation trigger requiring `stock_out_approval_id` for all `movement_type='inventory_out'` with `reason='request'`. Execution API accepts `approvalId` (not line_item_id) to ensure explicit FK link.

3. **Dual Reference Inconsistency (SOR + QMHQ Mismatch)** — Transaction has `stock_out_approval_id` but NULL `qmhq_id` when parent SOR has non-NULL `qmhq_id`, making transaction invisible on QMHQ detail page. **Prevention:** Add BEFORE INSERT trigger `auto_populate_qmhq_from_sor()` that traverses approval → line_item → request → qmhq chain and sets `qmhq_id` automatically. Add CHECK constraint validating consistency.

4. **Concurrent Execution Stock Depletion** — Two line items for same item execute simultaneously, both validate stock = 100, both approve, final stock = -10 (negative). **Prevention:** Use advisory locks (`pg_advisory_xact_lock()`) in stock validation function to serialize stock checks per item+warehouse. Alternative: SERIALIZABLE isolation level with retry logic for serialization failures.

5. **Audit Log Explosion** — Per-line execution multiplies audit events 3x (5 lines × (1 transaction + 1 line_item UPDATE + 1 request UPDATE) = 15 logs vs 5 logs before). **Prevention:** Selective audit logging (skip auto-computed status changes by checking if `updated_by` changed). Consider summary execution logs instead of per-transaction logs.

## Implications for Roadmap

Based on research, this milestone decomposes into 4 sequential phases:

### Phase 1: QMHQ Linking Fix (Quick Win)

**Rationale:** Unblocks QMHQ transaction visibility immediately; zero schema changes, single file modification in approval dialog.

**Delivers:** QMHQ detail page shows stock-out transactions from linked SORs; dual reference format established.

**Addresses:**
- QMHQ transaction visibility (table stakes feature)
- Dual reference traceability foundation

**Implementation:**
- Modify `components/stock-out-requests/approval-dialog.tsx`: Fetch `qmhq_id` from parent request, copy to transaction insert, format `reference_no` as "SOR-YYYY-NNNNN (QMHQ: QMHQ-YYYY-NNNNN)"
- Test: Approve SOR linked to QMHQ → verify transaction appears on QMHQ detail page

**Avoids:** Orphaned transaction pitfall (sets FK correctly from start)

**Research flag:** SKIP — Direct FK copy is standard pattern, no research needed.

---

### Phase 2: Dual Reference Display UI

**Rationale:** Builds on Phase 1 reference format; display-only component with no data mutations (low risk).

**Delivers:** Clickable SOR/QMHQ references in transaction lists across all pages (QMHQ detail, SOR detail, inventory dashboard).

**Addresses:**
- Dual reference traceability (table stakes feature)
- Bidirectional navigation UX

**Implementation:**
- Create `components/inventory/transaction-reference.tsx`: Parse `reference_no` with regex, render as linked code blocks
- Integrate into QMHQ detail transaction table, SOR detail transaction tab, inventory dashboard transaction list
- Handle NULL cases (manual SORs with no QMHQ link show only SOR reference)

**Avoids:** No pitfalls (read-only display component)

**Research flag:** SKIP — Conditional rendering pattern already established in codebase.

---

### Phase 3: Database Trigger Hardening

**Rationale:** Must complete BEFORE deploying per-line execution UI; prevents race conditions, orphaned transactions, status inconsistencies.

**Delivers:** Database-level guarantees for data integrity during concurrent operations.

**Addresses:**
- Stale parent status pitfall
- Orphaned transactions pitfall
- Dual reference consistency pitfall
- Concurrent stock depletion pitfall
- Duplicate execution pitfall

**Implementation:**
- **Status computation locking:** Add `FOR UPDATE` in `compute_sor_request_status()` function
- **Line item status propagation:** Add trigger on `stock_out_line_items` table to fire status recomputation on direct updates
- **Transaction linking validation:** Add BEFORE INSERT trigger requiring `stock_out_approval_id` for SOR executions
- **Auto-populate QMHQ link:** Add BEFORE INSERT trigger traversing approval → request → qmhq chain
- **Stock validation locking:** Implement `validate_stock_with_lock()` with advisory locks
- **Idempotency constraint:** Add UNIQUE index on `inventory_transactions(stock_out_approval_id)` WHERE movement_type='inventory_out'
- **Selective audit logging:** Modify audit triggers to skip auto-computed status changes
- **Audit indexes:** Add partial indexes per entity_type on `audit_logs(entity_id, changed_at)`

**Migration:** `0XX_execution_integrity_triggers.sql`

**Avoids:** ALL 5 critical pitfalls

**Research flag:** MEDIUM — Advisory locks and serializable isolation patterns need validation with load testing.

---

### Phase 4: Per-Line-Item Execution UI

**Rationale:** Depends on Phase 3 triggers being in place; final user-facing feature delivery.

**Delivers:** Execute button per line item, scoped execution dialog, status updates reflect per-line execution.

**Addresses:**
- Per-line-item execution UI (table stakes feature)
- Status accuracy (table stakes feature)

**Implementation:**
- Copy `components/stock-out-requests/execution-dialog.tsx` to `line-item-execution-dialog.tsx`: Add `lineItemId` prop (required), filter query by line item, update title
- Modify `components/stock-out-requests/line-item-table.tsx`: Add Actions column, Execute button per row (enabled when `status IN ('approved', 'partially_executed')`), pass `lineItemId` to dialog
- Modify `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`: Import LineItemExecutionDialog, wire up to line item table
- Implement query invalidation or real-time subscription for UI state sync after execution
- Add optimistic UI with rollback logic OR pessimistic loading states (TBD based on risk tolerance)

**Avoids:**
- Stale UI pitfall (via query invalidation)
- Optimistic rollback failures (via proper error handling)

**Research flag:** LOW — Per-row action pattern already used in approval dialogs; conditional rendering established; React Query invalidation is standard.

---

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Must establish data format (dual reference in `reference_no`) before building display component
- **Phase 3 before Phase 4:** Database integrity triggers MUST be deployed before per-line execution UI goes live; prevents data corruption from race conditions
- **Phase 2 independent of Phase 3:** Display component can be built in parallel with trigger work (no dependencies)
- **Sequential vs parallel:** Phases 1-2 can run in parallel if resources available; Phase 3 must complete before Phase 4 starts

**Dependency graph:**
```
Phase 1 (QMHQ Linking) ──→ Phase 2 (Dual Reference UI)
                       ↘
Phase 3 (Triggers) ────────→ Phase 4 (Per-Line Execution UI)
```

**How this avoids pitfalls:**
- Trigger hardening (Phase 3) deployed BEFORE UI (Phase 4) prevents race conditions from Day 1
- QMHQ linking fix (Phase 1) ensures dual references populate correctly from start
- Audit indexes (Phase 3) prevent performance degradation as execution volume scales

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Database Triggers):** Advisory lock patterns and serializable isolation need load testing validation; concurrent execution scenarios need E2E test design
- **Phase 4 (Per-Line UI):** Real-time subscription vs query invalidation decision depends on multi-tab usage patterns; optimistic vs pessimistic UI needs UX input

Phases with standard patterns (skip research-phase):
- **Phase 1 (QMHQ Linking):** FK copy is established pattern (already used for other entities)
- **Phase 2 (Dual Reference Display):** Conditional rendering and Link components already in codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | FK `qmhq_id` verified in migration 023; triggers verified in migration 053; component patterns verified in codebase |
| Features | HIGH | Requirements derived from existing v1.6 UAT feedback and QMHQ integration needs; table stakes clearly defined |
| Architecture | HIGH | Option A (copy qmhq_id) chosen based on existing patterns; trigger aggregation by line_item_id already works |
| Pitfalls | HIGH | Race conditions, orphaned records, audit explosion documented in PostgreSQL and inventory system literature; mitigations proven |

**Overall confidence:** HIGH

Research validated against existing codebase (migrations 023, 052, 053, component files, package.json). No external dependencies required. All architectural patterns already established in QM System (per-row actions, nullable FKs, status triggers, conditional rendering). Pitfalls identified from documented PostgreSQL trigger behavior and inventory system race condition patterns.

### Gaps to Address

**During Phase 3 planning:**
- **Advisory lock hash function stability:** Validate that MD5-based lock key generation from UUIDs produces consistent keys across PostgreSQL versions (test on local and remote Supabase instances)
- **Trigger execution order:** Confirm PostgreSQL fires BEFORE triggers before AFTER triggers within same transaction (verify behavior with multi-trigger INSERT test)

**During Phase 4 planning:**
- **Real-time subscription performance:** Measure Supabase real-time channel latency for multi-tab scenarios; fall back to query invalidation if >5 second lag
- **Optimistic UI trade-off:** Decide based on execution failure rate (if stock validation fails >10%, use pessimistic loading; if <2%, use optimistic with rollback)

**During load testing:**
- **Concurrent execution threshold:** Determine max concurrent line item executions system can handle before advisory lock contention causes delays (target: 10+ concurrent executions with <1s lock wait time)

**Validation needed:**
- QMHQ status auto-update: Should SOR execution trigger QMHQ status change to "done" group? (Business logic decision, not technical)
- Audit retention policy: How long to retain audit logs? Should implement table partitioning if >1 year retention? (Ops decision)

## Sources

### Primary (HIGH confidence)

**Verified in QM System codebase:**
- `supabase/migrations/023_inventory_transactions.sql` (line 76) — FK `qmhq_id` already exists
- `supabase/migrations/052_stock_out_requests.sql` — SOR schema, `qmhq_id` 1:1 link
- `supabase/migrations/053_stock_out_validation.sql` (lines 308-370) — Status computation triggers aggregate by `line_item_id`
- `components/stock-out-requests/execution-dialog.tsx` (lines 109-114) — Current batch execution query pattern
- `components/stock-out-requests/approval-dialog.tsx` — Approval creation (location for qmhq_id propagation)
- `.planning/phases/28-stock-out-request-approval-ui/28-CONTEXT.md` — v1.6 baseline context
- `package.json` — Current dependencies (verified no additions needed)

**PostgreSQL official documentation:**
- [PostgreSQL Trigger Behavior Documentation](https://www.postgresql.org/docs/current/trigger-definition.html) — Trigger execution order, FOR UPDATE locking
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — Row-level locking patterns
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — Foreign key constraints, CHECK constraints

### Secondary (MEDIUM confidence)

**Inventory system patterns:**
- [Warehouse Transaction Approval Cycles](https://asapsystems.com/warehouse-management/inventory-features/transaction-approval-cycles/) — Granular execution patterns
- [Inventory journal approval workflows - Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/inventory/inventory-journal-workflow) — Multi-level status aggregation

**Database integrity patterns:**
- [Referential Integrity Challenges](https://www.acceldata.io/blog/referential-integrity-why-its-vital-for-databases) — Orphaned record prevention
- [Atomic Updates and Data Consistency](https://medium.com/insiderengineering/atomic-updates-keeping-your-data-consistent-in-a-changing-world-f6aacf38f71a) — Concurrent execution race conditions
- [PostgreSQL Triggers Performance Impact](https://infinitelambda.com/postgresql-triggers/) — Selective audit logging, trigger optimization

**Supabase patterns:**
- [Supabase Querying Joins and Nested Tables](https://supabase.com/docs/guides/database/joins-and-nesting) — Nested JOIN pattern (evaluated but not chosen)
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes) — Foreign key constraint patterns

### Tertiary (LOW confidence)

**ERP integration patterns:**
- [ERP Integration Patterns](https://roi-consulting.com/erp-integration-patterns-what-they-are-and-why-you-should-care/) — Dual reference linking concepts (general guidance, not specific implementation)

---

*Research completed: 2026-02-11*
*Ready for roadmap: YES*
