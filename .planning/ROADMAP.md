# Roadmap: QM System

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-27)
- ✅ **v1.1 Enhancement** - Phases 5-10 (shipped 2026-01-28)
- ✅ **v1.2 Inventory & Financial Accuracy** - Phases 11-16 (shipped 2026-01-31)
- ✅ **v1.3 UX & Bug Fixes** - Phases 17-19 (shipped 2026-02-02)
- ✅ **v1.4 UX Enhancements & Workflow Improvements** - Phases 20-22 (shipped 2026-02-06)
- ✅ **v1.5 UX Polish & Collaboration** - Phases 23-26 (shipped 2026-02-09)
- 🚧 **v1.6 Stock-Out Approval & Data Integrity** - Phases 27-31 (in progress)

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
<summary>✅ v1.5 UX Polish & Collaboration (Phases 23-26) - SHIPPED 2026-02-09</summary>

Phases 23-26 delivered threaded comments on all detail pages, fluid font scaling with K/M/B abbreviation, two-step category-first item selectors, and unified QMHQ currency inheritance with dual Org/EUSD display.

</details>

### 🚧 v1.6 Stock-Out Approval & Data Integrity (In Progress)

**Milestone Goal:** Add request/approval workflow before stock-out operations, protect referenced entities from deletion, enable user deactivation, and provide contextual side sliders for related data visibility.

#### Phase 27: Stock-Out Approval DB Foundation
**Goal**: Database schema and business logic ready to support stock-out approval workflow
**Depends on**: Phase 26 (v1.5 complete)
**Requirements**: SOAR-01, SOAR-04, SOAR-09, SOAR-10, SOAR-11
**Success Criteria** (what must be TRUE):
  1. stock_out_requests table exists with workflow status tracking (Pending, Approved, Rejected)
  2. Stock validation RPC checks available inventory at both request and approval time
  3. RLS policies prevent unauthorized users from approving or viewing others' requests
  4. Audit trigger logs all stock-out request state changes (create, approval, rejection, cancellation)
  5. TypeScript types generated from schema and available for UI development
**Plans:** 3 plans

Plans:
- [x] 27-01-PLAN.md — Core SOR schema (3 tables, enums, ID generation, snapshot, computed status)
- [x] 27-02-PLAN.md — Stock validation, status transitions, over-execution blocking, fulfillment FK
- [x] 27-03-PLAN.md — RLS policies, audit triggers, TypeScript type generation

#### Phase 28: Stock-Out Request & Approval UI
**Goal**: Users can request stock-out and admins can approve/reject with partial approval support
**Depends on**: Phase 27
**Requirements**: SOAR-01, SOAR-02, SOAR-03, SOAR-05, SOAR-06, SOAR-07, SOAR-08
**Success Criteria** (what must be TRUE):
  1. QMHQ item route creates stock-out request with quantity pre-filled from QMHQ
  2. Inventory/Quartermaster can create manual stock-out request with item, warehouse, reason, and notes
  3. Admin sees pending stock-out requests list with item, requester, and quantity
  4. Admin can approve request with quantity less than or equal to requested (partial approval)
  5. Admin can reject request with mandatory rejection reason
  6. Requester can cancel own pending request
  7. QMHQ item detail page shows requested quantity and approved quantity
  8. Stock-out execution page only allows quantity up to approved amount
**Plans:** 3 plans

Plans:
- [x] 28-01-PLAN.md — Sidebar nav, permissions, request list page, request create form
- [x] 28-02-PLAN.md — Request detail page with line item table, approval dialog, rejection dialog
- [x] 28-03-PLAN.md — Execution dialog, QMHQ integration, stock-out page modification

#### Phase 29: Deletion Protection
**Goal**: Master data entities cannot be deactivated when referenced by active records
**Depends on**: Phase 26 (independent of stock-out workflow)
**Requirements**: DPRT-01, DPRT-02, DPRT-03, DPRT-04, DPRT-05, DPRT-06, DPRT-07
**Success Criteria** (what must be TRUE):
  1. Item deactivation blocked when referenced by QMHQ, PO line items, or inventory transactions
  2. Status deactivation blocked when assigned to any active QMRL or QMHQ
  3. Category deactivation blocked when assigned to any active QMRL, QMHQ, or item
  4. Department deactivation blocked when assigned to any user or QMRL
  5. Contact person deactivation blocked when referenced by any QMRL or QMHQ
  6. Supplier deactivation blocked when referenced by any PO
  7. Delete dialog shows generic error "Cannot delete: this item is in use" when references exist
**Plans:** 2 plans

Plans:
- [x] 29-01-PLAN.md — Database triggers to block deactivation of 6 entity types when actively referenced
- [x] 29-02-PLAN.md — Frontend error message updates to surface trigger errors in delete toast

#### Phase 30: User Deactivation
**Goal**: Admin can deactivate users without losing historical data attribution
**Depends on**: Phase 26 (independent of other v1.6 features)
**Requirements**: UMGT-01, UMGT-02, UMGT-03
**Success Criteria** (what must be TRUE):
  1. Admin can deactivate a user account from user management page
  2. Deactivated user cannot log in (blocked at auth middleware)
  3. Deactivated users filtered out of assignment dropdowns (assigned_to, created_by selects)
  4. Historical records preserve deactivated user's name and attribution (created_by, updated_by)
  5. Admin can reactivate a previously deactivated user
**Plans**: TBD

Plans:
- [ ] 30-01: [TBD during planning]

#### Phase 31: Context Sliders
**Goal**: Side sliders provide contextual information on stock-out and QMHQ create pages
**Depends on**: Phase 28 (needs stock-out pages to exist)
**Requirements**: CSLR-01, CSLR-02, CSLR-03, CSLR-04, CSLR-05
**Success Criteria** (what must be TRUE):
  1. Stock-out request page shows QMRL and QMHQ details in right side slider
  2. Stock-out approval page shows QMRL and QMHQ details in right side slider
  3. Stock-out execution page shows QMRL and QMHQ details in right side slider
  4. QMHQ create page shows QMRL data in right side slider (replaces existing context panel)
  5. Sliders are open by default on desktop, closed on mobile, and toggleable
**Plans**: TBD

Plans:
- [ ] 31-01: [TBD during planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 27 → 28 → 29 → 30 → 31

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation → Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs → UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC → Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach → Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload → Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23. Comments System | v1.5 | 3/3 | ✓ Complete | 2026-02-07 |
| 24. Responsive Typography | v1.5 | 2/2 | ✓ Complete | 2026-02-07 |
| 25. Two-Step Selectors | v1.5 | 2/2 | ✓ Complete | 2026-02-08 |
| 26. Currency Unification | v1.5 | 2/2 | ✓ Complete | 2026-02-08 |
| 27. Stock-Out Approval DB Foundation | v1.6 | 3/3 | ✓ Complete | 2026-02-09 |
| 28. Stock-Out Request & Approval UI | v1.6 | 3/3 | ✓ Complete | 2026-02-09 |
| 29. Deletion Protection | v1.6 | 2/2 | ✓ Complete | 2026-02-10 |
| 30. User Deactivation | v1.6 | 0/? | Not started | - |
| 31. Context Sliders | v1.6 | 0/? | Not started | - |
