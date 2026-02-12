# Project Research Summary

**Project:** QM System v1.9 - PO Smart Lifecycle, Cancellation Guards & PDF Export
**Domain:** Purchase Order Lifecycle Management & Financial Document Generation
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

The v1.9 milestone enhances the existing procurement system with three tightly-coupled capabilities: (1) a 6-state PO status engine that auto-calculates lifecycle position from invoice and stock-in events, (2) cancellation guards that enforce referential integrity while allowing appropriate business operations, and (3) server-side PDF export for receipts that match app UI styling. Research shows this is a **refinement milestone** leveraging existing architecture rather than introducing new paradigms — the database already has PO status enums, trigger infrastructure, and audit patterns established in migrations 015-041.

The recommended approach uses **database-level enforcement** for status calculation and guards (PostgreSQL triggers with `aa_`/`zz_` prefix ordering), **server-side PDF generation** (@react-pdf/renderer in Next.js Server Actions to avoid 300MB Puppeteer overhead), and **cascade feedback** patterns already proven in invoice void flows. The architecture follows the system's established pattern: triggers guarantee data consistency, server actions provide user feedback, and composite UI components display results.

Key risks center on **concurrent status updates** (mitigate with advisory locks following migration 058 pattern), **trigger ordering fragility** (enforce with documented prefix convention), and **PDF memory leaks in serverless** (use @react-pdf/renderer instead of Puppeteer, generate on-demand not during page load). All risks have proven mitigation patterns already present in the codebase.

## Key Findings

### Recommended Stack

The v1.9 milestone requires **only one new dependency** (@react-pdf/renderer ^4.3.2) while enhancing existing PostgreSQL trigger infrastructure. All status engine and guard logic uses built-in database features (PL/pgSQL triggers, enum types, advisory locks). This minimalist approach aligns with the system's philosophy: use database-level enforcement for data integrity, application layer for presentation.

**Core technologies:**
- **@react-pdf/renderer ^4.3.2** (NEW): Server-side PDF generation — React-like JSX API familiar to team, works in Next.js 14.2.13 without workarounds, generates PDFs without headless browser (vs Puppeteer's 300MB Chromium + 1-2s startup). Server-only bundle impact (~600KB), zero client impact.
- **PostgreSQL Triggers + Enums** (EXISTING): 6-state status engine — Proven pattern from migrations 015-016 (WAC calculation), 040-041 (invoice void cascade), 058 (advisory locks). Guarantees consistency across concurrent transactions, eliminates status drift.
- **Guard-Then-Cascade Trigger Chain** (EXISTING): Cancellation validation — `aa_` prefixed guards fire BEFORE to block invalid ops, `zz_` auditors fire AFTER to log cascade effects. Alphabetical ordering documented in migration 057 (deletion protection with 6 guard triggers).
- **Next.js Server Actions** (EXISTING): Cascade feedback — Type-safe void/cancel operations return structured results (affected entities, budget changes) for rich toast display. Pattern established in invoice void flow.

**Why NOT alternatives:**
- Puppeteer/Playwright for PDF: Too heavy (300MB), slow (1-2s cold start), overkill for structured receipts
- Application-layer status calculation: Unsafe (can be bypassed), race-prone (concurrent updates), inconsistent (stale reads)
- XState or workflow engine: Over-engineered for 6-state FSM, PostgreSQL triggers sufficient

### Expected Features

Research across procurement platforms (Oracle, NetSuite, Dynamics 365) and 3-way matching documentation confirms **6 table stakes features** and **4 differentiators** for this milestone.

**Must have (table stakes):**
- **6-State PO Status Engine** (not_started → partially_invoiced → awaiting_delivery → partially_received → closed + cancelled) — Industry standard lifecycle. Auto-calculated from 3-way matching (PO qty vs invoiced qty vs received qty).
- **Lock Mechanism for Closed POs** — Read-only state when status='closed' prevents data corruption. Admin-only unlock for corrections. Standard in Jira (closed issues), Salesforce (closed opportunities).
- **Cannot Cancel PO with Active Invoices** — Financial integrity guard. All enterprise systems (SAP, Oracle) enforce this. Allows cancellation after voiding invoices.
- **Cannot Void Invoice with Stock-In** — Inventory-finance alignment guard. Sage, QuickBooks enforce this. Prevents voiding invoices after goods physically received.
- **Invoice Receipt PDF** — Core financial document with invoice header, line items, totals, EUSD equivalent, company branding. Professional appearance expected.
- **GRN (Goods Received Note) PDF** — Warehouse proof-of-delivery for 3-way matching. Includes item details, quantities, warehouse reference, signature lines.

**Should have (differentiators):**
- **Stock-Out Request Receipt PDF** — Internal requisition proof for audit trail. Not common in basic procurement systems, adds accountability for warehouse movements. System already has SOR flow, PDF completes it.
- **QMHQ Money-Out Receipt PDF** — Expense reimbursement proof for requesters. Accounting systems have this (Expensify, Bill.com) but integrated procurement often skips it.
- **Real-time Status Updates** — UI auto-updates when invoice/stock-in created (database triggers + revalidatePath). Modern platforms (Coupa, Ariba) have this. Elevates UX above manual refresh.
- **Cascading Void Prevention with Dependency Chain** — Error messages show WHY void blocked with counts ("Cannot void: 3 stock-in transactions exist"). Better than generic "Cannot void".

**Defer (v2+):**
- **Partial PO Cancellation** — Tracking which line items cancelled vs active creates complexity. Close entire PO when complete, defer quantity adjustments to v2.
- **Reopen Closed PO** — Breaks 3-way matching integrity. Admin-only unlock for exceptional corrections is sufficient for v1.
- **Multi-Template PDF System** — User template selection adds cognitive load. Single consistent template matching app UI is cleaner. Defer customization to v2.

### Architecture Approach

The v1.9 architecture extends the existing 4-layer pattern: **Presentation** (PO detail pages, invoice pages, stock-in pages, PDF dialogs) → **Composite UI** (reusable PageHeader, DetailPageLayout, FilterBar components already established in v1.8) → **Server Actions** (voidInvoice, cancelPO, generatePDF with cascade feedback) → **Database Triggers** (status engine, guards, audit cascade). No new architectural paradigms introduced.

**Major components:**

1. **PO Status Engine** (Database Layer) — Pure function `calculate_po_status(po_id)` aggregates line item quantities, returns 6-state enum. Triggered AFTER invoice/stock-in events. Uses advisory locks (following migration 058 pattern) to prevent race conditions under concurrent load. Status is **calculated**, not stored as input.

2. **Guard-Then-Cascade Trigger Chain** (Database Layer) — BEFORE triggers with `aa_` prefix (block_po_cancel_with_invoices, block_invoice_void_with_stockin) fire first to validate operations. AFTER triggers with `zz_` prefix (audit_po_cancel_cascade, audit_invoice_void_cascade) fire last to log cascade effects. Alphabetical ordering guarantees execution sequence.

3. **Server Action Cascade Feedback** (Application Layer) — cancelPurchaseOrder() and voidInvoice() execute database mutations, then query cascade results (updated balance_in_hand, affected entities), return structured CancelPOResult/VoidInvoiceResult for UI consumption. Toast displays detailed feedback ("$5000 EUSD released to QMHQ-2026-00042. New balance: $12000").

4. **PDF Generator** (Application Layer) — generateInvoicePDF(), generateGRNPDF() in Server Actions use @react-pdf/renderer with JSX components (InvoicePDFDocument, GRNDocument). Atomic snapshot queries (single SELECT with joins) prevent stale data. Returns blob for browser download, no email integration (deferred to v2).

5. **Composite UI Slots** (Presentation Layer) — Existing PageHeader, DetailPageLayout components from v1.8 provide action slots, tab containers. New components (po-cancel-dialog, invoice-pdf-export, po-matching-tab) plug into these slots without layout changes.

**Architectural patterns:**
- **Trigger-Driven Status Engine**: Database calculates status from events, application displays it. Guarantees consistency, prevents drift.
- **Guard-Then-Cascade**: Ordered trigger execution (aa_ guards → core logic → zz_ auditors). Declarative in schema, guaranteed execution order.
- **Server Action Cascade Feedback**: Execute → query cascade → return structured result → toast display. Type-safe end-to-end.
- **PDF in Server Actions**: Generate server-side with @react-pdf/renderer, return blob to client. Smaller bundle, secure data access, consistent output.

### Critical Pitfalls

Research identified **10 pitfalls** (4 critical, 3 moderate, 3 minor). Top 5 to address:

1. **PO Status Calculation Race Conditions Under Concurrent Load** — Multiple concurrent invoice creations read stale `total_invoiced`, both calculate same status, wrong final state. **Avoid:** Use advisory locks (`pg_advisory_xact_lock(hashtext(po_id))`) in `calculate_po_status()` function following migration 058 pattern. Test with 5+ concurrent workers creating invoices for same PO.

2. **Void Cascade Trigger Ordering Creates Inconsistent State** — New PO cancellation triggers fire in wrong order relative to existing invoice void triggers, causing guards to fire after recalculation or audits to fire before operations complete. **Avoid:** Follow `aa_` (guards), `zz_` (auditors) prefix convention. Document trigger dependency graph in migration header comments. Review `SELECT tgname FROM pg_trigger ORDER BY tgname` to verify alphabetical ordering.

3. **Soft Delete + Foreign Key Cascade = Silent Data Loss** — PO cancellation uses soft delete (`is_active=false`) but foreign keys have `ON DELETE CASCADE`, causing accidental hard delete to wipe line items permanently. **Avoid:** Use status='cancelled' for cancellation (not soft delete). Verify all PO foreign keys use `ON DELETE RESTRICT` (already system pattern). Test: soft-delete PO, verify line items survive with `is_active=true`.

4. **State Machine Transitions Not Validated at Database Level** — Application enforces PO lifecycle (not_started → partially_invoiced → ...) but database allows direct `UPDATE purchase_orders SET status='closed' WHERE status='not_started'` bypassing logic. **Avoid:** Add BEFORE UPDATE trigger `validate_po_status_transition()` with allowed transitions array. Block invalid jumps (not_started → closed) and backwards transitions (closed → partially_invoiced). Only exception: cancelled from any state.

5. **PDF Generation Memory Leak in Serverless Environment** — Puppeteer browser instances accumulate memory (100-200MB base + 50-100MB per page), causing Vercel function timeouts after 10-20 PDF generations. **Avoid:** Use @react-pdf/renderer (10MB memory vs 200MB for Puppeteer). If Puppeteer needed, close browser in `finally` block. Better: offload to Supabase Edge Function for heavy PDFs.

**Phase-specific warnings:**
- Phase implementing status calculation: Must use advisory locks (Pitfall #1) and transition validation (Pitfall #4) in same migration.
- Phase adding cancellation: Must follow trigger ordering (Pitfall #2), use status not soft-delete (Pitfall #3), test voided invoice scenarios (Pitfall #6 from moderate section).
- Phase adding PDF export: Must use @react-pdf/renderer not Puppeteer (Pitfall #5), atomic snapshot queries (Pitfall #8 from minor section).

## Implications for Roadmap

Based on research, suggested **3-phase structure** with clear dependencies and minimal parallelization (triggers build on each other, must be sequential):

### Phase 1: PO Status Engine Enhancement
**Rationale:** Foundation for all other features. Cancellation guards depend on status calculation working correctly. Lock mechanism depends on status='closed' detection. Must come first.

**Delivers:**
- Refined `calculate_po_status()` function with edge case handling (over-invoicing, floating-point tolerance, zero quantities)
- Advisory locks for concurrent safety (following migration 058 pattern)
- State transition validation trigger (blocks invalid transitions like not_started → closed)
- Manual cancellation bypass (allows setting status='cancelled' directly, skips auto-calculation)

**Addresses:**
- **Table Stakes:** 6-State PO Status Engine (FEATURES.md)
- **Architecture:** PO Status Engine component (ARCHITECTURE.md)
- **Stack:** PostgreSQL Triggers + Enums (STACK.md)

**Avoids:**
- **Pitfall #1:** Race conditions via advisory locks
- **Pitfall #4:** Invalid state transitions via validation trigger
- **Pitfall #7:** Duplicate audit entries via idempotency check (skip UPDATE if status unchanged)

**Migration:** `068_po_smart_status_engine.sql`

**Test coverage:** Concurrent invoice creation (5+ workers), all valid transitions, block invalid transitions, manual cancellation from each state

---

### Phase 2: Cancellation Guards & Balance Cascade
**Rationale:** Depends on Phase 1 (status='cancelled' must be valid state). Guards protect financial integrity before PDF export added. Balance recalculation must work before users can see freed budget.

**Delivers:**
- `aa_block_po_cancel_with_invoices()` trigger (BEFORE UPDATE, blocks if active non-voided invoices exist)
- `aa_block_invoice_void_with_stockin()` **already exists** (migration 040), verify filter includes `is_voided=false`
- `zz_audit_po_cancel_cascade()` trigger (AFTER UPDATE, logs balance_in_hand change, affected QMHQ)
- PO cancellation dialog UI with guard feedback ("Cannot cancel: 3 active invoices. Void them first.")
- Balance in Hand recalculation trigger **already exists** (migration 015), verify excludes status='cancelled'

**Addresses:**
- **Table Stakes:** Cannot Cancel PO with Active Invoices, Cannot Void Invoice with Stock-In, Lock Mechanism for Closed POs (FEATURES.md)
- **Architecture:** Guard-Then-Cascade Trigger Chain, Server Action Cascade Feedback (ARCHITECTURE.md)
- **Stack:** Guard triggers with aa_/zz_ prefix (STACK.md)

**Avoids:**
- **Pitfall #2:** Trigger ordering via documented prefix convention
- **Pitfall #3:** Silent data loss via status='cancelled' (not soft delete), verify ON DELETE RESTRICT
- **Pitfall #6:** Voided invoice edge cases via `is_voided=false` filter in guard
- **Pitfall #9:** Balance not released via testing cancel → balance increases

**Migrations:** `069_po_cancellation_guards.sql`, `070_po_cancel_cascade_audit.sql`

**Test coverage:** Cancel with [no invoices, voided invoices, active invoices, mix], void with [no stock-in, with stock-in], balance recalculation after cancel

---

### Phase 3: PDF Export Infrastructure
**Rationale:** Depends on Phase 2 (cancellation must work so users can generate final PO PDF with correct status). Independent feature with no impact on status/guards, can be last.

**Delivers:**
- Install `@react-pdf/renderer@^4.3.2`
- PDF document components: `InvoicePDFDocument`, `GRNDocument`, `StockOutReceiptDocument`, `MoneyOutReceiptDocument`
- Server Actions: `generateInvoicePDF()`, `generateGRNPDF()`, `generateStockOutReceiptPDF()`, `generateMoneyOutReceiptPDF()`
- API routes (optional): `/api/pdf/invoice/[id]`, `/api/pdf/grn/[id]` if direct URL access needed
- UI: Export buttons in invoice detail, stock-in detail, stock-out detail, QMHQ money-out detail
- Company branding config: Logo upload (Supabase Storage), company name/address (env vars or config table)

**Addresses:**
- **Table Stakes:** Invoice Receipt PDF, GRN PDF (FEATURES.md)
- **Differentiators:** Stock-Out Request Receipt PDF, QMHQ Money-Out Receipt PDF (FEATURES.md)
- **Architecture:** PDF Generator component in Server Actions (ARCHITECTURE.md)
- **Stack:** @react-pdf/renderer in Next.js Server Actions (STACK.md)

**Avoids:**
- **Pitfall #5:** Memory leaks via @react-pdf/renderer (not Puppeteer), on-demand generation (not page load)
- **Pitfall #8:** Stale data via atomic snapshot queries (single SELECT with joins, not multiple queries)

**Installation:** `npm install @react-pdf/renderer@^4.3.2`

**File structure:**
```
components/pdf/
  ├─ styles.ts (Tailwind-like utility styles)
  ├─ invoice-receipt.tsx
  ├─ grn-receipt.tsx
  ├─ stock-out-receipt.tsx
  └─ money-out-receipt.tsx

lib/actions/
  └─ pdf-actions.ts (generateInvoicePDF, generateGRNPDF, ...)

app/(dashboard)/invoice/[id]/_components/
  └─ invoice-pdf-export.tsx (export dialog)
```

**Test coverage:** Invoice with 50+ line items (multi-page), missing logo (graceful degradation), EUSD rounding (2 decimals), concurrent exports (memory stability)

---

### Phase Ordering Rationale

- **Sequential dependencies:** Status engine (Phase 1) → Cancellation guards (Phase 2) → PDF export (Phase 3). Guards depend on status='cancelled' being valid. PDF depends on status showing correct lifecycle position.
- **Trigger complexity:** Phase 1 and 2 both add database triggers, must be done carefully in order to maintain `aa_`/`zz_` prefix chain. Phase 3 has no database changes, safest last.
- **Risk management:** Highest risk (concurrent status updates, trigger ordering) addressed first in Phases 1-2. Lowest risk (PDF generation) deferred to Phase 3.
- **Testing requirements:** Phase 1 needs concurrency testing (5+ workers). Phase 2 needs cascade testing (void → cancel workflows). Phase 3 needs memory testing (serverless limits). Sequential execution allows focused testing per phase.

**No parallelization recommended.** All three phases touch PO lifecycle (status, guards, display), parallel development risks merge conflicts in migrations and overlapping trigger modifications.

### Research Flags

**Phases needing deeper research during planning:**
- **None.** All three phases use established patterns already proven in codebase (migrations 015-058). Status calculation follows WAC trigger pattern (migration 059). Guards follow deletion protection pattern (migration 057). PDF generation is new stack addition but well-documented with strong community support (860K weekly downloads, 15.9K GitHub stars).

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Status Engine):** Follows trigger-driven calculation pattern from migration 059 (WAC), advisory lock pattern from migration 058 (stock validation). No research needed.
- **Phase 2 (Cancellation Guards):** Follows guard-then-cascade pattern from migrations 040-041 (invoice void), deletion protection from migration 057 (6 aa_block triggers). No research needed.
- **Phase 3 (PDF Export):** @react-pdf/renderer well-documented, integration guides exist for Next.js 14. Atomic snapshot queries are standard Supabase pattern. No research needed.

**Validation during implementation:**
- **Phase 1:** EXPLAIN ANALYZE on status calculation query (should be <50ms with proper indexes). Concurrent load test with 5+ workers verifying no status thrashing.
- **Phase 2:** Trigger ordering verification via `SELECT tgname FROM pg_trigger WHERE tgrelid='purchase_orders'::regclass ORDER BY tgname` (guards before audits).
- **Phase 3:** Heap snapshot before/after PDF generation (verify no retained browser objects, memory growth <20MB per PDF).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | @react-pdf/renderer mature (v4.3.2), Next.js 14.2.13 compatible (bug fixed in 14.1.1+). All database features built-in PostgreSQL (triggers, enums, advisory locks). Zero new database dependencies. Pattern proven in migrations 015-059. |
| Features | **HIGH** | Researched 15+ procurement platforms (Oracle, NetSuite, Dynamics, SAP) and 3-way matching documentation. 6-state status lifecycle is industry standard. Guard rules (cannot cancel with invoices, cannot void with stock-in) enforced by all major ERP systems. GRN receipts standard in warehouse operations. |
| Architecture | **HIGH** | Extends existing 4-layer pattern (Presentation → Composite UI → Server Actions → Database Triggers). All architectural patterns already proven in codebase: trigger-driven calculation (WAC in migration 059), guard-then-cascade (invoice void in migrations 040-041), server action feedback (existing voidInvoice), composite UI (7 components established in v1.8). |
| Pitfalls | **HIGH** | 4 critical pitfalls sourced from real-world cases: PrestaShop race condition bug (#23356), Supabase RLS recursion issue (#1138), Dynamics GP orphaned transactions from cascade misuse. All have proven mitigations: advisory locks (migration 058 pattern), trigger prefix convention (migration 057 pattern), RESTRICT foreign keys (system standard). |

**Overall confidence:** **HIGH**

### Gaps to Address

**No major gaps identified.** Research covered all critical areas with official documentation (PostgreSQL trigger docs, @react-pdf/renderer npm package, Next.js Server Actions) and real-world case studies (ERP void cascades, procurement workflows, PDF generation in serverless).

**Minor clarifications needed during implementation:**
- **Lock mechanism UI for closed POs:** Research confirms "lock icon + disabled fields" pattern from Jira/Salesforce, but exact UI placement (header badge vs inline lock icon) needs design decision. Not a research gap, implementation detail.
- **PDF footer content:** Research confirms company branding (logo, name, address), but export timestamp vs creation timestamp needs business rule clarification. Standard is export timestamp ("Generated on: 2026-02-12 14:30") but some systems show creation timestamp. User preference during implementation.
- **Voided invoice handling in cancellation guard:** Research confirms guard should filter `is_voided=false`, but whether to COUNT and display "Cannot cancel: 0 active invoices (3 voided)" vs silent success needs UX decision. Implementation detail, not research gap.

**Validation checkpoints:**
1. **After Phase 1 migration:** Run EXPLAIN ANALYZE on `calculate_po_status()` with 100+ line items, verify <50ms execution, index usage confirmed.
2. **After Phase 2 migration:** Query trigger ordering, verify aa_block triggers fire before zz_audit triggers.
3. **After Phase 3 implementation:** Load test PDF generation with 10 sequential requests, verify memory stays <500MB, no Vercel timeout errors.

## Sources

### Primary (HIGH confidence)

**PostgreSQL Official Documentation:**
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — BEFORE/AFTER triggers, RAISE EXCEPTION patterns, SECURITY DEFINER
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) — Advisory locks, FOR UPDATE, deadlock prevention
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — READ COMMITTED, REPEATABLE READ, SERIALIZABLE behaviors

**Stack Research:**
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — Official package v4.3.2, server-side rendering compatibility
- [Next.js API Routes Documentation](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) — Server Action patterns, binary file downloads

**Procurement Domain:**
- [Purchase Order Life Cycle - Oracle](https://docs.oracle.com/en/cloud/saas/procurement/25c/oaprc/purchase-order-life-cycle.html) — 6-state lifecycle standard
- [What Is Three-Way Matching - NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml) — PO qty vs invoice qty vs receipt qty matching
- [Approve and confirm purchase orders - Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-approval-confirmation) — Status transitions, cancellation rules

### Secondary (MEDIUM confidence)

**PDF Generation:**
- [NextJS 14 and react-pdf integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) — Integration guide with Next.js 14 workarounds
- [Top 6 Open-Source PDF Libraries for React](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025) — Comparison: @react-pdf vs jsPDF vs Puppeteer vs pdfmake
- [Building a PDF generation service using Nextjs and React PDF](https://03balogun.medium.com/building-a-pdf-generation-service-using-nextjs-and-react-pdf-78d5931a13c7) — Server Action patterns

**PostgreSQL Patterns:**
- [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — Modern trigger patterns, idempotency, performance optimization
- [Implementing State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) — FSM trigger validation patterns
- [How to Use Advisory Locks in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-advisory-locks-postgresql/view) — Advisory locks vs row locks, hashtext() pattern

**Real-World Cases:**
- [Race condition in Order::setInvoiceDetails - PrestaShop #23356](https://github.com/PrestaShop/PrestaShop/issues/23356) — Concurrent PO status update race condition causing doubled invoices
- [Infinite recursion when using users table for RLS - Supabase #1138](https://github.com/orgs/supabase/discussions/1138) — RLS recursion pitfall, SECURITY DEFINER solution
- [Dynamics GP SOP Orphaned Transactions](https://www.encorebusiness.com/blog/dynamics-gp-sop-orphaned-transactions-and-allocated-items/) — Foreign key cascade creating orphaned records

### Tertiary (LOW confidence, context validation)

**Performance Optimization:**
- [Optimizing Puppeteer PDF generation](https://www.codepasta.com/2024/04/19/optimizing-puppeteer-pdf-generation) — Memory leak mitigation (not directly applicable since using @react-pdf, but useful for serverless memory patterns)
- [We had a leak! Memory Leaks in Next.js](https://medium.com/john-lewis-software-engineering/we-had-a-leak-identifying-and-fixing-memory-leaks-in-next-js-622977876697) — Next.js memory profiling techniques (general patterns, not PDF-specific)

**Procurement Workflows:**
- [Procurement automation best practices for enterprises (2026)](https://business.amazon.com/en/blog/procurement-automation) — General automation trends (context, not specific implementation guidance)
- [Real-Time PO Matching - oAppsNet](https://www.oappsnet.com/2026/01/real-time-po-matching-closing-the-loop-between-procurement-and-payables/) — Conceptual real-time matching (validates "real-time status updates" as differentiator, not implementation details)

---

**Research completed:** 2026-02-12
**Ready for roadmap:** Yes
**Recommended phases:** 3 (Status Engine → Cancellation Guards → PDF Export)
**Estimated total effort:** 8-12 days (per FEATURES.md complexity assessment)
