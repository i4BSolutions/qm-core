# Project Research Summary

**Project:** QM System - PO Smart Lifecycle Milestone v1.4
**Domain:** Purchase Order Three-Way Matching & Lifecycle Management
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

The PO Smart Lifecycle milestone enhances QM System's existing purchase order functionality with intelligent three-way matching (PO ↔ Invoice ↔ Stock-in), visual matching panels, progress tracking, and automatic lock mechanisms. Research reveals that **most of the infrastructure already exists** — the system has sophisticated PostgreSQL triggers tracking `invoiced_quantity` and `received_quantity`, a `POProgressBar` component, and comprehensive audit logging. This milestone is primarily about **UI enhancements and presentation improvements** over existing calculation logic.

The recommended approach is **database-driven status calculation using existing triggers** with zero new external dependencies except `@radix-ui/react-accordion` (~8KB) for the collapsible matching panel. Three-way matching is table stakes in modern procurement systems, but the visual presentation (side-by-side comparison, real-time progress bars, color-coded status indicators) is a competitive differentiator. The architecture leverages Server Components by default, with optional client-side wrapping for real-time updates via router.refresh() or TanStack Query.

The critical risk is **trigger cascade integration** — adding new triggers that update the same tables existing triggers maintain can cause infinite recursion loops. Other key risks include race conditions during concurrent status calculations, RLS policy performance degradation with complex nested queries, and voided invoice exclusion consistency across all UI queries. All risks have well-documented mitigation patterns: `pg_trigger_depth()` guards, row-level locking with `FOR UPDATE`, database VIEWs for calculation consistency, and SECURITY DEFINER functions to bypass nested RLS checks.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, Supabase PostgreSQL, Radix UI, Tailwind CSS, Lucide icons) is sufficient for all milestone requirements. Database-driven architecture using PostgreSQL generated columns and triggers eliminates need for React state management libraries or charting components.

**Add:**
- `@radix-ui/react-accordion` (^1.2.2) — Collapsible matching panel with accessibility

**Don't add:**
- Charting libraries (Recharts, ECharts) — Tailwind gradients sufficient for progress bars
- State management (Zustand, Jotai) — Server Components + database triggers handle calculations
- Table libraries — TanStack Table already installed; custom accordion provides better UX for matching panel

**Core technologies (existing):**
- PostgreSQL triggers — Three-way match calculation already implemented via `calculate_po_status()` and cascading triggers
- Radix UI primitives — Accessible components (Dialog, Tabs, Tooltip) already in use
- Tailwind CSS — Gradient utilities for progress bars, no CSS-in-JS needed
- Next.js Server Components — Zero JS for non-interactive UI, faster initial render

**Database architecture:**
- Generated columns (STORED) for `total_price` calculations already implemented
- Cascading triggers update `invoiced_quantity` → `received_quantity` → PO status
- Audit logging automatically captures status changes including closure events
- Trigger deduplication pattern using 2-second time windows prevents duplicate audit entries

### Expected Features

**Must have (table stakes):**
- Three-way quantity matching (PO qty = Invoice qty = Stock-in qty) — Core procurement control
- Auto-calculated PO status — Manual status management error-prone; automation expected in 2026
- Status priority rules — When partially invoiced AND partially received, deterministic status (PRD: Partially Invoiced > Partially Received)
- Quantity availability display — Users need "Available to Invoice" (Ordered - Already Invoiced)
- PO closure detection — System recognizes when all line items fully matched
- Lock on closed PO — Prevent data corruption; already blocks invoice creation, extend to edits
- Admin override/reopen — Business reality requires reopening closed POs (vendor credits, returns)
- Voided invoice exclusion — Voided invoices must not count toward matching calculations

**Should have (competitive differentiators):**
- Visual matching panel — Side-by-side PO vs Invoice vs Stock comparison (standard ERPs hide this in reports)
- Progress bar with % — Shows completion toward "Closed" status visually (modern UX pattern)
- Line-level matching detail — Drill down to see WHICH items are behind (most systems only show PO-level totals)
- Real-time status updates — Status updates immediately when invoice/stock-in created (not batch nightly)
- Color-coded variance indicators — Red/yellow/green for over/under/matched quantities (visual clarity)
- Multiple partial invoices — System already supports multiple invoices per PO; matching panel shows ALL

**Defer (v2+):**
- Status history timeline — Use existing History tab with audit log integration
- Automated discrepancy resolution — Flag discrepancies; require human review (AI/ML risks financial errors)
- Four-way matching (+ Payment) — QM System scope is procurement, not AP payment processing

**Anti-features (explicitly NOT build):**
- Automatic PO closure — Business reality: discrepancies happen; require admin confirmation
- Edit invoices after stock-in — Breaks three-way matching integrity; require void + recreate
- Tolerance-based auto-approval — Defeats fraud prevention purpose of three-way matching

### Architecture Approach

The system already calculates three-way match status via cascading PostgreSQL triggers. New features integrate as **UI presentation layers** over existing infrastructure with one database gap: stock-in transactions don't update `invoice_line_items.received_quantity` or `po_line_items.received_quantity`. This requires two new triggers to complete the cascade chain.

**Data flow (complete three-way match):**
```
Stock-in INSERT → update_invoice_line_received_quantity()
  → invoice_line_items.received_quantity updated
  → update_po_line_received_quantity()
  → po_line_items.received_quantity updated
  → trigger_update_po_status() (EXISTING)
  → purchase_orders.status recalculated
  → create_audit_log() (EXISTING)
  → audit_logs (closure event if status = 'closed')
```

**Major components:**
1. **POMatchingPanel** (NEW) — Server Component rendering three-column comparison (PO | Invoice | Stock); data from single Supabase query joining `po_line_items`, `invoice_line_items`, `inventory_transactions`
2. **POProgressBar** (ENHANCE) — Add legend, mismatch highlighting; existing implementation already shows dual progress bars (invoiced %, received %)
3. **POLockIndicator** (NEW) — Lock badge + alert banner when status = 'closed'; queries audit log for closure event metadata
4. **Database triggers** (NEW) — Two triggers to complete stock-in → received_quantity cascade

**Integration points:**
- PO detail page (`/app/(dashboard)/po/[id]/page.tsx`) after line 334 (Financial Summary Panel) before Tabs
- Lock indicator after line 238 (status badges in header)
- Progress bar enhancement in existing usage (line 328)

**Architectural patterns:**
- Server Components first — Keep non-interactive UI as Server Components (zero JS bundle)
- Cascading triggers — Database triggers update aggregations automatically; no application code for calculations
- Trigger deduplication — 2-second time window prevents duplicate audit entries (pattern from `048_status_update_with_note.sql`)
- Snapshot pattern — PO/Invoice line items preserve historical data even if master data changes

### Critical Pitfalls

1. **Trigger cascade infinite loops** — Adding new triggers that UPDATE same tables existing triggers maintain creates recursion (max 32 levels → database unusable). **Prevention:** Use `pg_trigger_depth() > 1` guards; prefer VIEWs for read-only aggregations; never add triggers that update tables existing triggers already maintain.

2. **Race conditions in concurrent status calculation** — Two simultaneous operations (invoice + stock-in) read current state, calculate status, UPDATE → last-write-wins data loss. **Prevention:** Use `FOR UPDATE` row-level locking when reading data for status calculation; prefer statement-level triggers over row-level for aggregations; use Serializable isolation level for critical operations.

3. **Lock mechanism bypassed by direct database updates** — Implementing lock checks only in UI/API layer allows direct PostgREST access to bypass locks. **Prevention:** Implement lock checks as database triggers (NOT just UI); add RLS policy for closed POs; whitelist legitimate bypass scenarios (invoice void cascade) using `SECURITY DEFINER` functions with session variables.

4. **Voided invoice exclusion not applied consistently** — New UI queries include voided invoices in totals, breaking invariant "voided invoices don't count." **Prevention:** Create database VIEW `po_three_way_match` with `i.is_voided = false` check; all queries (UI, status calculation, progress bar) use this VIEW instead of ad-hoc queries; add integration test for voided invoice scenario.

5. **RLS policy performance degradation** — Complex nested RLS policies with subqueries evaluated per-row cause N+1 queries (60+ RLS evaluations per matching panel load). **Prevention:** Index columns used in RLS policies; use SECURITY DEFINER functions to bypass nested RLS checks; wrap functions in SELECT to cache results; profile with `EXPLAIN (ANALYZE, BUFFERS)`.

## Implications for Roadmap

Research reveals the milestone is **smaller than initially expected** — most infrastructure exists. Suggested 4-phase structure focuses on completing database layer, then layering UI enhancements.

### Phase 1: Complete Three-Way Match Calculation
**Rationale:** Database foundation must be complete before UI enhancements. Stock-in → received_quantity cascade is the only missing piece.

**Delivers:**
- Two new triggers: `update_invoice_line_received_quantity()`, `update_po_line_received_quantity()`
- Complete cascade: stock-in → invoice line → PO line → PO status → audit log
- Validation testing with complex scenarios (multiple invoices, partial stock-ins, voided invoices)

**Addresses features:**
- Three-way quantity matching (table stakes)
- Auto-calculated PO status (table stakes)
- Voided invoice exclusion (table stakes)

**Avoids pitfalls:**
- Trigger recursion (use `pg_trigger_depth()` guards)
- Race conditions (add `FOR UPDATE` locks)
- Voided exclusion inconsistency (validate in trigger logic)

**Research flag:** LOW — Clear implementation pattern from existing triggers; no unknowns.

### Phase 2: Visual Matching Panel
**Rationale:** With accurate calculations in place, add primary UI differentiator (side-by-side comparison).

**Delivers:**
- `POMatchingPanel` component with three-column layout (PO qty | Invoiced qty | Received qty)
- Server Component fetching data via single Supabase query
- Color coding (amber = invoiced, emerald = received)
- Integration into PO detail page after Financial Summary Panel

**Addresses features:**
- Visual matching panel (differentiator)
- Line-level matching detail (differentiator)
- Quantity availability display (table stakes)

**Uses stack:**
- `@radix-ui/react-accordion` for collapsible line item details
- Tailwind CSS for color coding and layout
- Next.js Server Components for zero-JS initial render

**Avoids pitfalls:**
- RLS performance (use SECURITY DEFINER functions if needed)
- Voided invoice exclusion (query uses VIEW from Phase 1)

**Research flag:** LOW — Radix Accordion well-documented; clear integration point in existing page.

### Phase 3: Enhanced Progress Bars & Lock Indicators
**Rationale:** Complementary UI enhancements that depend on accurate status calculation (Phase 1).

**Delivers:**
- Enhanced `POProgressBar`: legend, mismatch highlighting, completion indicator
- `POLockIndicator`: lock badge, alert banner, link to audit trail
- Disabled form fields when status = 'closed'
- Admin override UI (reopen with reason)

**Addresses features:**
- Progress bar with % (differentiator)
- Lock on closed PO (table stakes)
- Admin override/reopen (table stakes)
- Color-coded variance indicators (differentiator)

**Implements architecture:**
- Lock indicator queries audit log for closure metadata
- Lock enforcement via database triggers (from Phase 1)
- Conditional rendering based on `canEditPO(status)` utility

**Avoids pitfalls:**
- Lock bypass (database triggers enforce lock, not just UI)
- UI sync issues (disable fields immediately based on lock state)
- Progress calculation mismatch (use same logic as status calculation)

**Research flag:** LOW — UI polish work; no complex integration.

### Phase 4: Real-Time Updates & Polish (Optional)
**Rationale:** Real-time updates improve UX but not critical for MVP. Can defer if time-constrained.

**Delivers:**
- Optional client component wrapper for PO detail page
- `router.refresh()` on window focus for automatic updates
- Connection status indicator if using Supabase Realtime
- Manual refresh button
- Optimistic UI updates with reconciliation

**Addresses features:**
- Real-time status updates (differentiator, but MVP works without)

**Uses stack:**
- React useOptimistic (available in React 18.3.1, already installed)
- TanStack Query for background polling (optional, if aggressive refreshing needed)

**Avoids pitfalls:**
- Realtime state sync failures (implement subscription cleanup, fallback polling)
- WebSocket connection drops (manual refresh button as fallback)

**Research flag:** MEDIUM — Supabase Realtime edge cases need testing; can skip for MVP.

### Phase Ordering Rationale

**Sequential dependencies:**
- Phase 1 must complete first — UI components depend on accurate database calculations
- Phase 2 and 3 can be parallel (no dependencies between matching panel and lock indicators)
- Phase 4 is optional polish (MVP works without real-time updates)

**Grouping logic:**
- Phase 1 isolates database risk (trigger testing) before UI work
- Phases 2-3 are pure UI enhancements (low risk, high visibility)
- Phase 4 separated as "nice-to-have" for schedule flexibility

**Pitfall avoidance:**
- Critical pitfalls (trigger recursion, race conditions, lock bypass) all addressed in Phase 1
- UI phases inherit safe foundation from database layer
- Moderate pitfalls (RLS performance, realtime sync) only affect optional Phase 4

### Research Flags

**Needs research during planning:**
- None — All phases have clear implementation patterns from existing codebase and well-documented libraries.

**Standard patterns (skip research-phase):**
- Phase 1: Database triggers follow existing patterns in migrations 016, 022, 023, 048
- Phase 2: Radix Accordion documented; integration point clear
- Phase 3: UI conditional rendering; standard React patterns
- Phase 4: Supabase Realtime documented; optional phase can be prototyped

**Recommended approach:** Proceed directly to phase planning and implementation. Research was comprehensive; no unknowns remain.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new major dependencies; existing stack sufficient; Radix Accordion well-established |
| Features | HIGH | Three-way matching table stakes verified across 6+ industry sources; differentiators identified |
| Architecture | HIGH | Existing trigger infrastructure verified in codebase; clear integration points; missing triggers straightforward |
| Pitfalls | HIGH | Critical pitfalls (trigger recursion, race conditions, lock bypass) have documented mitigation patterns |

**Overall confidence:** HIGH

### Gaps to Address

**Tolerance configuration:**
- Research identified need for matching tolerance (2% or 1 unit) for partial deliveries
- PRD doesn't specify tolerance rules
- **Handling:** Phase 1 can implement strict matching (no tolerance); add tolerance in future iteration if users report POs stuck at 99.5% matched

**RLS policy performance:**
- Complex RLS policies on `po_line_items` may cause slow matching panel queries
- Won't know until production-scale data
- **Handling:** Profile queries during Phase 2 with `EXPLAIN ANALYZE`; optimize with SECURITY DEFINER functions if needed

**Realtime subscription reliability:**
- Supabase Realtime WebSocket edge cases (connection drops, reconnection)
- Only affects optional Phase 4
- **Handling:** Implement with manual refresh fallback; monitor in production; can skip Phase 4 for MVP

**Admin override audit:**
- Audit logging for admin reopening closed POs needs clear requirements
- **Handling:** Reuse existing `update_status_with_note()` RPC function pattern from migration 048; require reason text

## Sources

### Primary (HIGH confidence)

**Stack & Architecture:**
- PostgreSQL Documentation: Generated Columns — https://www.postgresql.org/docs/current/ddl-generated-columns.html
- PostgreSQL Triggers in 2026: Performance Reality — https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/
- Cybertec: PostgreSQL Trigger Performance — https://www.cybertec-postgresql.com/en/are-triggers-really-that-slow-in-postgres/
- React useOptimistic Hook — https://react.dev/reference/react/useOptimistic
- Radix UI Accordion Documentation — https://www.radix-ui.com/primitives/docs/components/accordion

**Features (Three-Way Matching Best Practices):**
- 3-Way Invoice Matching in Accounts Payable — https://start.docuware.com/blog/document-management/3-way-invoice-matching
- What is 3-Way Match? How It Works in AP Process — https://tipalti.com/resources/learn/3-way-match/
- Three-Way Matching & Why Important | NetSuite — https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml
- Best Practices for 2-way and 3-way Match — https://optisconsulting.com/best-practices-for-2-way-and-3-way-match/

**Pitfalls (Database Concurrency & Locking):**
- PostgreSQL Trigger Recursion and How to Deal With It — https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/
- Database Race Conditions: A System Security Guide — https://blog.doyensec.com/2024/07/11/database-race-conditions.html
- How To Prevent Race Conditions in Database — https://medium.com/@doniantoro34/how-to-prevent-race-conditions-in-database-3aac965bf47b
- PostgreSQL Advisory Locks — https://medium.com/@erkanyasun/postgresql-advisory-locks-a-powerful-tool-for-application-level-concurrency-control-8a147c06ec39

**Supabase Optimization:**
- Supabase RLS Performance and Best Practices — https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Optimizing RLS Performance with Supabase — https://medium.com/@antstack/optimizing-rls-performance-with-supabase-postgres-fa4e2b6e196d
- Supabase Realtime: Managing Subscriptions — https://app.studyraid.com/en/read/8395/231602/managing-real-time-subscriptions

### Secondary (MEDIUM confidence)

**Procurement Industry Patterns:**
- Procurement Dashboards: Examples & KPIs (2026) — https://www.superblocks.com/blog/procurement-dashboard
- Purchase Order Overview - Dynamics 365 — https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-overview
- The Procurement Lifecycle: 7 Stages Explained — https://ramp.com/blog/procurement-process-lifecycle

**PO Lifecycle Management:**
- Closing and Reopening Purchase Orders — https://support.infor.com/esknowbase/root/DLPublic/10884/ch12.pdf
- What Happens If a Purchase Order Is Closed? (Oracle) — https://docs.oracle.com/en/cloud/saas/procurement/25b/oaprc/what-happens-if-a-purchase-order-is-closed.html

### Tertiary (Codebase Verification)

**QM System Existing Implementation:**
- `supabase/migrations/016_po_line_items.sql` — PO line items with `invoiced_quantity`, `received_quantity` tracking fields
- `supabase/migrations/022_invoice_line_items.sql` — Invoice triggers updating `po_line_items.invoiced_quantity`
- `supabase/migrations/023_inventory_transactions.sql` — Stock-in records with `invoice_line_item_id` references
- `supabase/migrations/048_status_update_with_note.sql` — Audit trigger deduplication pattern (2-second time window)
- `lib/utils/po-status.ts` — Status configuration and `canEditPO()` utility
- `components/po/po-progress-bar.tsx` — Existing dual progress bar (invoiced %, received %)
- `app/(dashboard)/po/[id]/page.tsx` — PO detail page with clear integration points (lines 238, 334)

---

**Research completed:** 2026-02-03
**Ready for roadmap:** Yes
**Recommendation:** Proceed directly to phase planning — no unknowns remain; implementation patterns clear.
