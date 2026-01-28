# Project Research Summary

**Project:** QM System v1.2 - Inventory & Financial Accuracy Milestone
**Domain:** Inventory Management with Multi-Currency WAC Valuation and Cascade Recalculation
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

v1.2 enhances an existing inventory management system with advanced financial accuracy features. Research reveals this milestone requires **zero new external dependencies** — the existing Next.js 14 + Supabase + PostgreSQL stack handles all requirements through database trigger optimization and component composition. The core challenge is implementing cascade recalculation correctly: when an invoice is voided, the system must automatically update PO status, Balance in Hand, and item WAC values while maintaining data consistency.

The recommended approach uses PostgreSQL's native AFTER UPDATE triggers with recursion guards, statement-level trigger execution to avoid N+1 performance issues, and extends existing WAC calculation logic to handle cross-currency manual stock-ins. Dashboard features follow proven patterns from the existing management dashboard (RPC functions for aggregation, parallel data fetching, client-side KPI calculations). This is a **low-risk milestone** because all patterns already exist in the codebase — the challenge is integration, not invention.

The critical risk is trigger recursion leading to deadlocks when cascade recalculation fires multiple dependent triggers. Prevention requires careful trigger call graph design, `pg_trigger_depth()` guards, and comprehensive integration testing of the void-invoice cascade path (invoice → PO status → Balance in Hand → WAC → audit logs). Secondary risks include full-history WAC recalculation performance (mitigated with proper indexing) and stale dashboard data (mitigated with appropriate Next.js cache configuration).

## Key Findings

### Recommended Stack

v1.2 requires **no new packages**. The existing stack is sufficient:

**Core technologies:**
- **PostgreSQL (via Supabase)**: Native triggers for cascade recalculation, AFTER UPDATE with transition tables for batch operations — proven pattern in existing WAC triggers
- **Intl.NumberFormat (native browser API)**: Handles 4-decimal exchange rate display with `formatCurrency(value, 4)` — no external library needed
- **@tanstack/react-table 8.21.3**: Already implements warehouse detail WAC display, reuse for inventory dashboard tables
- **Next.js Server Actions**: Parallel data fetching with Promise.all prevents waterfall performance issues (validated in management dashboard)

**What NOT to add:**
- Charting libraries (Recharts, Chart.js): Requirements specify KPI cards and tables, not graphs. Existing Card components handle all display needs.
- Number formatting libraries (react-number-format): Native Intl.NumberFormat supports arbitrary precision, already in use via `formatCurrency()`.
- Specialized trigger libraries: PostgreSQL native triggers with Supabase migrations cover all cascade logic.

**Key stack insight:** Existing codebase patterns in `024_inventory_wac_trigger.sql`, `033_dashboard_functions.sql`, and `warehouse/[id]/page.tsx` provide blueprints for all v1.2 features.

### Expected Features

**Must have (table stakes):**
- Transaction history dashboard with date range filtering — users expect this in all inventory systems
- Per-warehouse WAC breakdown — when showing inventory value, users expect cost basis per location
- Multi-currency manual stock-in with exchange rate input — international operations require local currency recording
- Invoice void cascade recalculation — automatic financial accuracy (competitors require manual reconciliation)
- Date picker consistency (DD/MM/YYYY) — completes v1.1 standardization across all date inputs

**Should have (competitive differentiators):**
- Warehouse inventory breakdown with per-item WAC and EUSD values — most systems only show aggregate, this creates transparency
- Transaction source linking (show which invoice/PO triggered stock movement) — relationship exists, exposing aids audit
- Balance in Hand auto-update on invoice void — maintains PO route financial integrity automatically
- Low stock alerts with transaction context — existing alerts enhanced with recent movement visibility

**Defer (v2+):**
- Stock movement analytics (trends, velocity calculations) — get basic visibility working first
- Advanced filtering (user, reason, source entity) — date + warehouse sufficient for v1.2
- CSV export — internal tool, dashboard view sufficient for now
- Predictive inventory suggestions — requires historical data analysis, not v1 scope

### Architecture Approach

v1.2 extends three existing patterns: (1) **Database triggers** for cascade logic — AFTER UPDATE on invoices fires recalculation of PO line items → inventory transactions → item WAC → audit logs in single transaction; (2) **RPC aggregation** for dashboard KPIs — single `get_inventory_dashboard_stats()` function returns all metrics to avoid N+1 queries, proven in management dashboard; (3) **Server Actions with parallel fetching** — Promise.all combines RPC call + recent transactions query without waterfall.

**Major components:**

1. **Database Trigger Layer** — `cascade_invoice_void_recalculation()` trigger on invoices table, calls existing `update_item_wac()` and `calculate_po_status()` triggers. Enhanced WAC trigger handles cross-currency conversion (manual stock-in in THB converts to item's MMK WAC). Uses `pg_trigger_depth()` guards to prevent recursion.

2. **Server Action Layer** — `lib/actions/inventory.ts` with `getInventoryDashboardData()` (parallel RPC + queries), `voidInvoice()` (single UPDATE triggers cascade), `createManualStockIn()` (enhanced with currency fields). Pattern matches existing `lib/actions/dashboard.ts` exactly.

3. **Presentation Layer** — `app/(dashboard)/inventory/page.tsx` reuses KPICard pattern from management dashboard. Warehouse detail page unchanged (already has WAC display). Stock-in form enhanced with currency selector (reuses pattern from financial transactions). Invoice detail gets void button with optimistic UI updates.

**Integration complexity:** MEDIUM — extends proven patterns but cascade trigger ordering requires careful testing. All individual patterns exist; risk is in the cascade interaction.

### Critical Pitfalls

1. **Trigger Recursion from Cascade Recalculation** — When invoice void triggers WAC recalculation, which triggers audit logging, which references invoice table, creates circular dependencies. PostgreSQL allows infinite recursion until stack overflow. **Prevention:** Use `pg_trigger_depth() > 1` guard in triggers, add WHEN clauses to conditionally fire, monitor with `auto_explain.log_triggers`. **Phase impact:** Must design trigger call graph in Phase 1 before implementation.

2. **Full-History WAC Recalculation Performance** — Naive void triggers full scan of all inventory_in transactions for item (10,000+ transactions = 5+ second operation, blocks entire items table row). **Prevention:** Add compound index on `(item_id, status, movement_type)`, use covering index with INCLUDE clause, consider incremental updates (store counters) for items with >1000 transactions. **Phase impact:** Add indexes in Phase 1 migration, test with large transaction volumes.

3. **Negative Stock Breaking WAC Calculation** — WAC formula divides by total quantity. If inventory goes negative (backdated transaction, race condition, transfer timing), division by zero corrupts WAC. **Prevention:** Enhanced validation in `validate_stock_out_quantity()` checks pending transactions (not just completed), WAC trigger skips update if `total_qty <= 0`, UI blocks backdated transactions unless admin role. **Phase impact:** Phase 1 database validation prevents corruption, Phase 2 UI warns users.

4. **Invoice Void Doesn't Update PO Status** — Existing PO status calculation doesn't exclude voided invoices (`is_voided = true`), showing PO as "fully invoiced" when actually not. Balance in Hand calculation wrong. **Prevention:** Create view `po_line_items_with_invoice_status` that filters `i.is_voided = false`, add trigger `recalculate_po_status_on_void()` that fires when is_voided changes, update Balance in Hand query to join with voided check. **Phase impact:** Phase 1 trigger ensures cascade completes atomically.

5. **Dashboard N+1 Query Problem** — Loading 50 warehouses with separate query per warehouse for stats = 150 database round-trips, 8-12 second page load. **Prevention:** Single RPC function `get_warehouse_dashboard_data()` with JSON aggregation, materialized view `warehouse_dashboard_stats` (refresh on transaction), pagination if needed. **Phase impact:** Phase 2 dashboard must use aggregation query, not per-warehouse fetching.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Database Foundation (Cascade Triggers & Indexing)
**Rationale:** Database changes are foundation, must be deployed before application changes. Triggers ensure data consistency regardless of UI bugs. Indexing prevents performance degradation at scale.

**Delivers:**
- Migration: `034_invoice_void_cascade.sql` with `cascade_invoice_void_recalculation()` trigger
- Migration: `035_inventory_dashboard_functions.sql` with `get_inventory_dashboard_stats()` RPC
- Enhanced WAC trigger with cross-currency conversion logic
- Compound indexes on `inventory_transactions` for fast WAC recalculation
- Database validation for negative stock prevention

**Addresses:**
- Invoice void cascade recalculation (table stakes)
- PO status accuracy after void (critical pitfall #4)
- WAC calculation performance (critical pitfall #2)

**Avoids:**
- Trigger recursion (pitfall #1) via `pg_trigger_depth()` guards
- Full-history scan performance issues (pitfall #2) via proper indexing

**Research flag:** LOW — PostgreSQL trigger patterns well-documented, existing WAC trigger provides blueprint. **Needs validation:** Trigger execution order (test with concurrent operations).

### Phase 2: Inventory Dashboard UI
**Rationale:** Once RPC functions exist, dashboard can consume them. Follows proven management dashboard pattern. No new component patterns needed.

**Delivers:**
- `app/(dashboard)/inventory/page.tsx` with KPI cards (transaction counts, total values EUSD)
- `components/inventory/inventory-stats-cards.tsx` reusing KPICard pattern
- `components/inventory/top-items-table.tsx` using existing DataTable wrapper
- Warehouse filter, date range filter, transaction type grouping
- Server Action `getInventoryDashboardData()` with parallel RPC + queries fetching

**Addresses:**
- Transaction visibility dashboard (table stakes)
- Warehouse filtering (table stakes)
- Date range filtering (table stakes)

**Avoids:**
- N+1 query problem (pitfall #5) via single RPC aggregation
- Stale data after void (moderate pitfall) via `revalidate: 60` cache config

**Uses:**
- @tanstack/react-table for tables (existing stack)
- Intl.NumberFormat for 4-decimal exchange rates (existing utility)
- Next.js Server Actions for data fetching (existing pattern)

**Research flag:** NONE — KPI pattern validated in warehouse detail page, RPC pattern validated in management dashboard. Standard implementation.

### Phase 3: Warehouse Detail Enhancements
**Rationale:** Warehouse detail page already exists with WAC display. Enhancement adds per-item breakdown with exchange rates. Minimal change to proven component.

**Delivers:**
- Enhanced warehouse detail table with WAC amount, currency, exchange rate columns (4-decimal display)
- Stock movement by item section (link to item detail)
- EUSD value per item row
- Sorting by value, name, stock quantity

**Addresses:**
- Per-warehouse WAC breakdown (table stakes)
- Warehouse inventory breakdown with per-item WAC (differentiator)

**Implements:**
- Uses existing `warehouse_inventory` view (no new query needed)
- Extends existing `formatCurrency()` utility with 4-decimal parameter
- Reuses DataTableColumnHeader for sorting

**Research flag:** NONE — Existing implementation at lines 194-275 in warehouse/[id]/page.tsx demonstrates pattern. Just add columns.

### Phase 4: Manual Stock-In with Currency Support
**Rationale:** Once WAC trigger handles currency conversion, UI can expose currency/exchange rate inputs. Follows existing financial transaction form pattern.

**Delivers:**
- Enhanced `app/(dashboard)/inventory/stock-in/page.tsx` form
- Currency dropdown (reuses pattern from PO/Invoice forms)
- Exchange rate input (4-decimal validation with Zod)
- Unit cost input (2-decimal validation)
- Smart defaults: fetch latest exchange rate for selected currency from `financial_transactions`
- Form validation: if currency ≠ MMK, exchange rate ≠ 1.0 (prevents pitfall #8)

**Addresses:**
- Multi-currency manual stock-in (table stakes)
- Exchange rate input (table stakes)
- WAC factors in converted cost (table stakes)

**Avoids:**
- Missing exchange rate causing WAC corruption (moderate pitfall #8) via Zod schema validation
- Multi-currency rounding errors (moderate pitfall #6) via enhanced trigger precision

**Research flag:** NONE — Form pattern matches existing invoice form with currency. WAC trigger tested in Phase 1.

### Phase 5: Invoice Void UI & Cascade Verification
**Rationale:** Last phase enables user-facing void action. Requires all backend cascade logic (Phase 1) to be deployed and tested first. Includes comprehensive integration testing.

**Delivers:**
- Void button on invoice detail page (Admin/Finance roles only)
- Void confirmation modal with reason input
- Server Action `voidInvoice()` with optimistic UI updates
- Refetch logic: invoice detail, related PO, dashboard stats
- Success toast shows cascade effects: "Invoice voided. PO status updated. WAC recalculated."
- Integration tests: void → verify PO status, Balance in Hand, WAC, audit logs

**Addresses:**
- Invoice void cascade recalculation (differentiator)
- Balance in Hand recalculation on void (differentiator)
- Audit trail for cascade effects (table stakes)

**Avoids:**
- Stale dashboard after void (moderate pitfall #7) via `revalidatePath()` and `router.refresh()`
- UI shows old PO status (minor pitfall #10) via Server Action returning updated status

**Research flag:** LOW — Server Action mutation pattern standard. **Needs deep testing:** Full cascade integration test (invoice → PO → Balance in Hand → WAC → QMHQ status).

### Phase 6: Date Picker Standardization (Standalone)
**Rationale:** Quick win, completes v1.1 standardization. No dependencies on other phases. Can be implemented in parallel with Phase 1-2.

**Delivers:**
- Update money-in and money-out forms to use DD/MM/YYYY format
- Consistency across all transaction date inputs (QMRL, QMHQ, inventory, financial)
- Update date-fns formatting calls to use `dd/MM/yyyy` pattern

**Addresses:**
- Date consistency (table stakes)
- Completes v1.1 date picker work

**Research flag:** NONE — v1.1 already established pattern, just extend to financial transaction forms.

### Phase Ordering Rationale

- **Phase 1 first:** Database triggers are foundation. If cascade logic is wrong, all downstream features break. Must validate trigger call graph and indexing before building UI.
- **Phases 2-4 parallel-safe:** Dashboard, warehouse detail, and stock-in form are independent UI features that consume Phase 1 database changes. Can be developed concurrently after Phase 1 completes.
- **Phase 5 last:** Invoice void is the integration point for all cascade logic. Requires Phase 1 backend + testing infrastructure. High-risk feature, needs comprehensive E2E testing.
- **Phase 6 standalone:** Date picker is independent, quick win. Can be shipped anytime to show progress.

**Architecture justification:** This order follows the existing codebase pattern: migrations → Server Actions → UI components. Matches how v1.0/v1.1 were built (validated in CLAUDE.md iteration structure).

**Pitfall avoidance:** By building triggers first (Phase 1), we catch recursion and performance issues early with unit tests. Building UI later (Phases 2-5) means UI bugs don't corrupt data — database ensures consistency.

### Research Flags

**Phases needing deeper research during planning:**
- **None** — All patterns validated in existing codebase. Lowest research risk milestone to date.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** PostgreSQL trigger patterns well-documented, existing WAC trigger provides template
- **Phase 2:** Dashboard pattern matches management dashboard (033_dashboard_functions.sql, dashboard.ts, dashboard/page.tsx)
- **Phase 3:** Warehouse detail enhancement trivial (add columns to existing table)
- **Phase 4:** Stock-in form matches invoice form pattern (currency + exchange rate fields)
- **Phase 5:** Server Action mutation pattern standard (matches file upload, status change actions)
- **Phase 6:** Date formatting established in v1.1

**Testing emphasis:** Phase 5 (Invoice Void) requires **intensive integration testing** of cascade path. Not complex architecture, but many moving parts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Zero new dependencies, all patterns exist in codebase (verified via package.json, migrations, warehouse detail implementation) |
| Features | **HIGH** | Multiple authoritative sources (Microsoft Dynamics 365, NetSuite, MRPeasy) confirm KPI patterns, WAC display, transaction history requirements |
| Architecture | **HIGH** | RPC aggregation proven (management dashboard), WAC trigger exists (migration 024), Server Action pattern validated (dashboard.ts) |
| Pitfalls | **HIGH** | Critical pitfalls sourced from PostgreSQL official docs, Microsoft ERP documentation, production PostgreSQL guides (thelinuxcode.com 2026 analysis) |
| Trigger Cascade | **MEDIUM** | Pattern is standard, but execution order and recursion prevention need thorough testing with concurrent operations |
| Performance | **MEDIUM** | Indexing strategy sound (compound indexes, covering indexes), but bulk void performance (100+ invoices) needs production load testing |

**Overall confidence:** HIGH

This is the **lowest-risk milestone** of v1.x series. All technology patterns pre-validated, no new libraries, architecture extends proven codebase patterns. Risk is in **integration testing thoroughness**, not architectural unknowns.

### Gaps to Address

**1. Trigger Execution Order Guarantee**
- **Gap:** PostgreSQL documentation confirms triggers fire in alphabetical order by trigger name, but unclear if this is guaranteed across versions or just implementation detail.
- **Impact:** If cascade triggers fire out of order, WAC or PO status could be incorrect.
- **Mitigation:** Design triggers to be order-independent where possible. Add integration test that validates all cascade effects regardless of execution order. Document expected sequence in migration comments.
- **When to validate:** Phase 1 implementation, test with concurrent invoice voids.

**2. Materialized View Refresh Performance**
- **Gap:** No production data on `REFRESH MATERIALIZED VIEW CONCURRENTLY` performance with 10,000 items × 20 warehouses.
- **Impact:** If refresh takes >2 seconds, dashboard shows stale data during refresh.
- **Mitigation:** Start with non-materialized RPC function (simpler, always fresh). Add materialized view only if performance requires it. Monitor query time in Phase 2, optimize in Phase 4 if needed.
- **When to validate:** Phase 2 dashboard implementation, benchmark with production-scale data.

**3. WAC Calculation Precision Requirements**
- **Gap:** No definitive source on accounting standard precision for inventory valuation. Research suggests DECIMAL(15,2) standard, but some sources mention DECIMAL(20,6) for intermediate calculations.
- **Impact:** If precision too low, compound rounding errors over hundreds of transactions (moderate pitfall #6).
- **Mitigation:** Existing trigger uses DECIMAL(15,2), which matches QM System's financial precision standard (PRD.md). Consider adding high-precision intermediate columns (DECIMAL(20,6)) if reconciliation audits flag >1% error.
- **When to validate:** Phase 4 manual stock-in testing with cross-currency conversions. Run monthly reconciliation job (`audit_wac_accuracy()` from pitfalls research).

**4. Dashboard Auto-Refresh Strategy**
- **Gap:** Management dashboard uses 60-second polling (useInterval), but unclear if Supabase real-time subscriptions (WebSocket) more efficient for inventory dashboard.
- **Impact:** Polling creates unnecessary database load if data rarely changes; WebSocket adds complexity.
- **Mitigation:** Start with 60-second polling (proven pattern). Monitor Supabase connection count and query volume. If load becomes issue, evaluate real-time subscriptions in post-v1.2 optimization.
- **When to validate:** Phase 2 dashboard implementation, use existing pattern unless performance issues arise.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [PostgreSQL: Documentation: 18: 37.1. Overview of Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html) — Trigger execution order, recursion behavior
- [Postgres Triggers | Supabase Docs](https://supabase.com/docs/guides/database/postgres/triggers) — Supabase-specific trigger patterns
- [Intl.NumberFormat - JavaScript | MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — Native formatting with arbitrary precision
- [Next.js Data Fetching Patterns and Best Practices](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns) — Server Actions, parallel fetching, caching

**ERP System Documentation (Production Patterns):**
- [Inventory close - Supply Chain Management | Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/cost-management/inventory-close) — Invoice void cascade patterns
- [Inventory dashboards | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/intelligent-order-management/inventory-dashboards) — Dashboard KPI best practices
- [Cascade Update of Cost on Inventory Transactions - IFS Documentation](https://ifs-train.westsidecorporation.com/ifsdoc/documentation/en/MaintainInventory/AboutCascadeUpdateofInvTrans.htm) — WAC recalculation patterns

**Codebase (Highest Confidence):**
- `supabase/migrations/024_inventory_wac_trigger.sql` — Existing WAC calculation trigger, status change handling (lines 111-164)
- `supabase/migrations/033_dashboard_functions.sql` — RPC aggregation pattern (get_qmrl_status_counts, get_qmhq_status_counts)
- `lib/actions/dashboard.ts` — Parallel fetching pattern with Promise.all
- `app/(dashboard)/warehouse/[id]/page.tsx` — Client-side KPI calculation (lines 176-182), WAC display (lines 194-275)
- `lib/utils/index.ts` — formatCurrency() with variable decimal precision

### Secondary (MEDIUM confidence)

**Performance & Production Reality:**
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality – TheLinuxCode](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — Statement-level vs row-level performance (2x vs 13x slower), recursion prevention
- [rules vs. trigger performance when logging bulk updates - Cybertec](https://www.cybertec-postgresql.com/en/rules-or-triggers-to-log-bulk-updates/) — Batch update optimization
- [What is the N+1 Query Problem and How to Solve it? - PlanetScale](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it) — Aggregation query patterns

**WAC Calculation:**
- [Weighted Average Cost - Accounting Inventory Valuation Method - CFI](https://corporatefinanceinstitute.com/resources/accounting/weighted-average-cost-method/) — WAC formula, precision requirements
- [WAC Knowledge Base | Zoho Inventory](https://www.zoho.com/us/inventory/kb/items/inventory-wac-report.html) — Display patterns for WAC in inventory systems
- [Weighted Average Inventory Method: Complete Guide - Finale Inventory](https://www.finaleinventory.com/accounting-and-inventory-software/weighted-average-inventory-method) — Cascade recalculation handling

**Dashboard Patterns:**
- [11 Most Important Inventory Management KPIs in 2026 | MRPeasy](https://www.mrpeasy.com/blog/inventory-management-kpis/) — Standard KPIs: transaction counts, total values, movement metrics
- [6 Ways Inventory Dashboards Maximize Visibility & Profitability | NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/6-ways-inventory-dashboards-maximize-visibility-profitability.shtml) — Warehouse filtering, date range patterns
- [Inventory Management Dashboard | UI Bakery templates](https://uibakery.io/templates/inventory-management-dashboard) — UI layout patterns

**Multi-Currency:**
- [Multi-Currency Accounting and Inventory Software - BlueLinkERP](https://www.bluelinkerp.com/blog/why-multi-currency-accounting-and-inventory-software-is-critical-for-global-growth/) — Exchange rate handling, rounding prevention
- [Rounding issues when using multi-currency - Manager.io Forum](https://forum.manager.io/t/rounding-issues-when-using-multi-currency/1622) — Precision requirements, compound error examples

### Tertiary (LOW confidence, patterns only)

**General Inventory UI:**
- [Inventory Movement Report: Guide in 2026 - HashMicro](https://www.hashmicro.com/blog/inventory-movement-report/) — Transaction history display patterns
- [How to view movement history - inFlow Inventory](https://www.inflowinventory.com/support/cloud/how-do-i-see-the-movement-or-transaction-history/) — UI conventions for transaction lists

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
