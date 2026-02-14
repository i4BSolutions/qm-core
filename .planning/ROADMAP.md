# Roadmap: QM System

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-27)
- ✅ **v1.1 Enhancement** - Phases 5-10 (shipped 2026-01-28)
- ✅ **v1.2 Inventory & Financial Accuracy** - Phases 11-16 (shipped 2026-01-31)
- ✅ **v1.3 UX & Bug Fixes** - Phases 17-19 (shipped 2026-02-02)
- ✅ **v1.4 UX Enhancements & Workflow Improvements** - Phases 20-22 (shipped 2026-02-06)
- ✅ **v1.5 UX Polish & Collaboration** - Phases 23-26 (shipped 2026-02-09)
- ✅ **v1.6 Stock-Out Approval & Data Integrity** - Phases 27-31 (shipped 2026-02-10)
- ✅ **v1.7 Stock-Out Request Logic Repair** - Phases 32-35 (shipped 2026-02-11)
- ✅ **v1.8 UI Consistency, Flow Tracking & RBAC** - Phases 36-40 (shipped 2026-02-12)
- ✅ **v1.9 PO Lifecycle, Cancellation Guards & PDF Export** - Phases 41-43 (shipped 2026-02-13)
- 🚧 **v1.10 Tech Debt Cleanup** - Phases 44-46 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-27</summary>

Phases 1-4 delivered foundational authentication, QMRL/QMHQ modules, purchase orders, invoices, and inventory management with audit logging.

</details>

<details>
<summary>✅ v1.1 Enhancement (Phases 5-10) - SHIPPED 2026-01-28</summary>

Phases 5-10 delivered file attachments, management dashboard, quick status changes, and date picker standardization.

</details>

<details>
<summary>✅ v1.2 Inventory & Financial Accuracy (Phases 11-16) - SHIPPED 2026-01-31</summary>

Phases 11-16 delivered warehouse detail with WAC display, inventory dashboard, manual stock-in, and invoice void cascade.

</details>

<details>
<summary>✅ v1.3 UX & Bug Fixes (Phases 17-19) - SHIPPED 2026-02-02</summary>

Phases 17-19 delivered attachment delete fixes, fulfillment progress tracking, number input behavior fixes, and standardized currency display.

</details>

<details>
<summary>✅ v1.4 UX Enhancements & Workflow Improvements (Phases 20-22) - SHIPPED 2026-02-06</summary>

Phases 20-22 delivered file upload in QMRL form, QMRL context panel, thousand separators, responsive amounts, item price reference, auto-generated SKU codes, inline item creation, multi-tab auth handling, and mandatory contact person validation.

</details>

<details>
<summary>✅ v1.5 UX Polish & Collaboration (Phases 23-26) - SHIPPED 2026-09-09</summary>

Phases 23-26 delivered threaded comments on all detail pages, fluid font scaling with K/M/B abbreviation, two-step category-first item selectors, and unified QMHQ currency inheritance with dual Org/EUSD display.

</details>

<details>
<summary>✅ v1.6 Stock-Out Approval & Data Integrity (Phases 27-31) - SHIPPED 2026-02-10</summary>

Phases 27-31 delivered stock-out request/approval workflow with partial approval and atomic execution, deletion protection for 6 entity types, user deactivation with login blocking, and context sliders for QMHQ and stock-out pages.

</details>

<details>
<summary>✅ v1.7 Stock-Out Request Logic Repair (Phases 32-35) - SHIPPED 2026-02-11</summary>

Phases 32-35 delivered per-line-item stock-out execution, QMHQ transaction linking with SOR-grouped display, dual reference display (SOR + QMHQ), database trigger hardening with advisory locks, and aggregate fulfillment metrics.

</details>

<details>
<summary>✅ v1.8 UI Consistency, Flow Tracking & RBAC (Phases 36-40) - SHIPPED 2026-02-12</summary>

Phases 36-40 delivered 7 composite UI components with 32-page migration, RBAC overhaul from 7 to 3 roles with 92 RLS policies, and admin-only end-to-end flow tracking page.

</details>

<details>
<summary>✅ v1.9 PO Lifecycle, Cancellation Guards & PDF Export (Phases 41-43) - SHIPPED 2026-02-13</summary>

Phases 41-43 delivered PO smart status engine with 6-state auto-calculation, cancellation/void guards at DB and UI levels, admin-only closed PO unlock, PO Matching tab, per-line-item progress bars, and professional dark-themed PDF receipt export for invoices, stock-out requests, and money-out transactions.

</details>

---

### Phase 44: PO Edit Capability

**Goal:** Users can edit PO header fields (supplier, notes, dates) while line items and financial amounts remain immutable.

**Dependencies:** None (extends existing PO detail page)

**Plans:** 1 plan

Plans:
- [x] 44-01-PLAN.md -- PO edit page with header-only editing and server action with audit logging

**Requirements:**
- POED-01: User can edit PO header fields (supplier, notes, expected delivery date) from detail page -- line items, amounts, currency, and exchange rate are not editable
- POED-02: PO edit is blocked when PO status is closed or cancelled (consistent with existing guards)

**Success Criteria:**
1. User can navigate to PO edit page from detail page Edit button
2. User can modify supplier, notes, and expected delivery date
3. Line items, amounts, currency, and exchange rate are displayed read-only (not editable)
4. Edit page shows clear block message when PO status is closed or cancelled
5. All edits trigger audit logging with before/after values

---

### Phase 45: Flow Tracking Performance Optimization

**Goal:** Flow tracking page performs reliably at production scale without materialized views.

**Dependencies:** None (optimizes existing flow tracking VIEW from v1.8)

**Plans:** 1 plan

Plans:
- [ ] 45-01-PLAN.md -- Database indexes + VIEW optimization (OR join elimination) + loading skeleton with Suspense

**Requirements:**
- FLOW-01: Flow tracking page loads within acceptable time for production data volumes
- FLOW-02: Flow tracking VIEW has appropriate indexes for common query patterns

**Success Criteria:**
1. Flow tracking VIEW query executes in under 2 seconds with 10,000+ QMRLs
2. Database has covering indexes on frequently joined columns (qmrl_id, qmhq_id, po_id, invoice_id)
3. EXPLAIN ANALYZE shows no sequential scans on large tables
4. Page renders with loading skeleton during data fetch
5. Admin can load any QMRL chain without timeout errors

---

### Phase 46: Composite Component Type Safety

**Goal:** Composite components enforce stricter prop types without breaking existing usage.

**Dependencies:** None (refines existing composite components from v1.8)

**Requirements:**
- TYPE-01: Composite component props tightened from ReactNode to string where only strings are used
- TYPE-02: Composite components retain ReactNode for props that genuinely need rich content

**Success Criteria:**
1. PageHeader title and subtitle props accept string only (no ReactNode)
2. FormField label prop accepts string only
3. DetailPageLayout title prop accepts string only
4. TypeScript compilation succeeds with no new type errors in existing pages
5. Props that need rich content (e.g., badge elements, custom actions) retain ReactNode type

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation -> Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs -> UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC -> Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach -> Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload -> Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23-26. Comments -> Currency | v1.5 | 9/9 | ✓ Complete | 2026-02-09 |
| 27-31. Stock-Out -> Sliders | v1.6 | 12/12 | ✓ Complete | 2026-02-10 |
| 32-35. Linking -> Execution UI | v1.7 | 7/7 | ✓ Complete | 2026-02-11 |
| 36-40. UI Composites -> RBAC -> Flow Tracking | v1.8 | 15/15 | ✓ Complete | 2026-02-12 |
| 41. PO Status Engine Enhancement | v1.9 | 2/2 | ✓ Complete | 2026-02-12 |
| 42. Cancellation Guards & Lock Mechanism | v1.9 | 3/3 | ✓ Complete | 2026-02-12 |
| 43. PDF Export Infrastructure | v1.9 | 3/3 | ✓ Complete | 2026-02-12 |
| 44. PO Edit Capability | v1.10 | 1/1 | ✓ Complete | 2026-02-14 |
| 45. Flow Tracking Performance | v1.10 | 0/? | 🚧 Pending | - |
| 46. Composite Type Safety | v1.10 | 0/? | 🚧 Pending | - |

---
*Last updated: 2026-02-14 after phase 44 execution*
