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
- 🚧 **v1.9 PO Lifecycle, Cancellation Guards & PDF Export** - Phases 41-43 (in progress)

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

### v1.9 PO Lifecycle, Cancellation Guards & PDF Export (In Progress)

**Milestone Goal:** Complete the PO lifecycle with smart status engine, enforce cancellation/void guards, and enable PDF receipt export for key documents.

#### Phase 41: PO Status Engine Enhancement

**Goal**: PO status auto-calculates lifecycle position from invoice and stock-in events with database-level consistency guarantees

**Depends on**: Phase 40 (v1.8 shipped)

**Requirements**: POSE-01, POSE-02, POSE-03, POSE-04, POSE-05

**Success Criteria** (what must be TRUE):
  1. PO status badge displays one of 6 states (not_started, partially_invoiced, awaiting_delivery, partially_received, closed, cancelled) on list and detail pages
  2. Status automatically recalculates when user creates invoice, voids invoice, or confirms stock-in transaction
  3. When PO has both invoiced and received items but neither complete, status shows "partially_invoiced" (not "partially_received")
  4. User can hover over status badge to see tooltip explaining current state (e.g., "3 of 5 items invoiced, 1 of 5 received")
  5. User can manually set status to "cancelled" which bypasses auto-calculation for that PO

**Plans:** 2 plans

Plans:
- [x] 41-01-PLAN.md -- Database engine: fix status priority (invoice-first), add advisory locks, cancellation columns/audit, cancelPO Server Action
- [x] 41-02-PLAN.md -- UI enhancement: status badge with tooltip, list/detail visual indicators, cancel dialog with cascade toast

#### Phase 42: Cancellation Guards & Lock Mechanism

**Goal**: Enforce financial integrity via cancellation guards and lock closed POs from editing

**Depends on**: Phase 41 (status engine must recognize 'closed' and 'cancelled' states)

**Requirements**: LOCK-01, LOCK-02, LOCK-03, LOCK-04, POCN-01, POCN-02, POCN-03, INVV-01, INVV-02, INVV-03, INVV-04, INVV-05, INVV-06, INVV-07, GARD-01, GARD-02, POPR-01, POPR-02, POPR-03

**Success Criteria** (what must be TRUE):
  1. User can cancel a PO (with no active invoices) via Cancel button with confirmation dialog, and cancelled PO shows visual indicator and is excluded from Balance in Hand
  2. User can void an invoice (with no stock-in) via Void button with required void reason, and voided invoices display with strikethrough styling and "VOIDED" badge
  3. When invoice is voided, PO status recalculates automatically and QMHQ Balance in Hand updates (budget released), with detailed toast showing cascade effects
  4. Voided invoices appear grayed out with VOID label in PO Matching tab (visible for audit trail)
  5. When user attempts to cancel PO with active invoices or void invoice with stock-in, system blocks with dependency chain error showing counts
  6. When PO status is "closed", all fields become read-only and Edit/Cancel buttons are hidden (except for Admin users)
  7. Admin user can unlock a closed PO via explicit "Unlock" action, make corrections, and PO automatically re-locks when status recalculates to closed
  8. User can view per-line-item progress bars on PO detail showing ordered qty vs invoiced qty vs received qty
  9. User can view Matching tab on PO detail with side-by-side comparison highlighting under-invoiced or under-received items

**Plans**: TBD

Plans:
- [ ] 42-01: TBD (planned during phase planning)

#### Phase 43: PDF Export Infrastructure

**Goal**: Generate professional PDF receipts for invoices, stock-out requests, and QMHQ money-out transactions

**Depends on**: Phase 42 (cancellation must work so users can generate final PO PDF with correct status)

**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05

**Success Criteria** (what must be TRUE):
  1. User can download Invoice Receipt PDF from invoice detail page containing header, line items, totals, and EUSD equivalent
  2. User can download Stock-Out Receipt PDF from stock-out transaction detail (SOR-based) showing items, quantities, and warehouse reference
  3. User can download Money-Out Receipt PDF from QMHQ money-out transaction detail showing amount, currency, exchange rate, and EUSD
  4. PDFs match app UI styling (colors, fonts, spacing) with professional print-friendly appearance
  5. PDFs include company branding (name, logo if configured) and export timestamp in footer ("Generated on: YYYY-MM-DD HH:MM")

**Plans**: TBD

Plans:
- [ ] 43-01: TBD (planned during phase planning)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation → Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs → UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC → Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach → Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload → Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23-26. Comments → Currency | v1.5 | 9/9 | ✓ Complete | 2026-02-09 |
| 27-31. Stock-Out → Sliders | v1.6 | 12/12 | ✓ Complete | 2026-02-10 |
| 32-35. Linking → Execution UI | v1.7 | 7/7 | ✓ Complete | 2026-02-11 |
| 36-40. UI Composites → RBAC → Flow Tracking | v1.8 | 15/15 | ✓ Complete | 2026-02-12 |
| 41. PO Status Engine Enhancement | v1.9 | 2/2 | ✓ Complete | 2026-02-12 |
| 42. Cancellation Guards & Lock Mechanism | v1.9 | 0/? | Not started | - |
| 43. PDF Export Infrastructure | v1.9 | 0/? | Not started | - |

---
*Last updated: 2026-02-12 after Phase 41 execution complete*
