# Roadmap: QM System

## Milestones

- **v1.0 MVP** - Foundation (shipped pre-existing)
- **v1.1 Enhancement** - Phases 1-6 (shipped 2026-01-28)
- **v1.2 Inventory & Financial Accuracy** - Phases 7-12 (current)

## Phases

<details>
<summary>v1.1 Enhancement (Phases 1-6) - SHIPPED 2026-01-28</summary>

### Phase 1: PO Creation Workflow Fix
**Goal**: Users can create purchase orders without workflow blockers
**Plans**: 3 plans (completed)

### Phase 2: Stock-In Functionality Fix
**Goal**: Users can receive inventory via manual stock-in and from invoices
**Plans**: 3 plans (completed)

### Phase 3: Invoice Quantity Validation
**Goal**: System prevents over-invoicing beyond PO quantities
**Plans**: 2 plans (completed)

### Phase 4: File Attachment System
**Goal**: Users can attach, preview, and download files on QMRL/QMHQ
**Plans**: 3 plans (completed)

### Phase 5: Management Dashboard
**Goal**: Admin/Quartermaster can view system KPIs and alerts
**Plans**: 3 plans (completed)

### Phase 6: Status & Transaction UX
**Goal**: Users experience consistent date formats and quick status changes
**Plans**: 3 plans (completed)

</details>

### v1.2 Inventory & Financial Accuracy (Current)

**Milestone Goal:** Users can accurately track inventory values with WAC, view comprehensive inventory dashboards, and rely on automatic financial recalculations when invoices are voided.

#### Phase 7: UX Polish
**Goal**: Number inputs and date pickers work consistently across all transaction forms
**Depends on**: Phase 6
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Transaction date picker (money in/out) displays DD/MM/YYYY format matching system standard
  2. Number input fields allow direct typing without default value interference
  3. Number input fields reject negative values and zero where inappropriate
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — Calendar dropdowns and transaction dialog fixes
- [x] 07-02-PLAN.md — Propagate number input fixes to PO, Invoice, Stock forms

#### Phase 7.1: Attachment & Item Route Fixes (INSERTED)
**Goal**: Fix attachment deletion and enhance QMHQ item route with multi-item stock-out capability
**Depends on**: Phase 7
**Requirements**: Urgent fixes discovered post-Phase 7
**Success Criteria** (what must be TRUE):
  1. Users can delete attachments from QMRL and QMHQ detail pages
  2. Date picker calendar shows simple navigation without month/year dropdowns
  3. QMHQ item route triggers stock-out when request is fulfilled
  4. QMHQ item route form supports selecting multiple items (no unit price field)
**Plans**: 3 plans

Plans:
- [x] 07.1-01-PLAN.md — Fix attachment permissions and simplify date picker
- [x] 07.1-02-PLAN.md — Database: auto stock-out trigger and multi-item schema
- [x] 07.1-03-PLAN.md — Multi-item UI for QMHQ item route

#### Phase 8: Database Foundation
**Goal**: Database layer supports currency-aware WAC calculation and invoice void cascades
**Depends on**: Phase 7.1
**Requirements**: Enables STCK-04, VOID-01, VOID-02, VOID-03, VOID-04
**Success Criteria** (what must be TRUE):
  1. Manual stock-in with currency/exchange rate correctly updates item WAC
  2. Voiding an invoice automatically recalculates PO status
  3. Voiding an invoice automatically updates Balance in Hand
  4. Voiding an invoice automatically updates invoiced quantities
  5. All void cascade effects are logged to audit trail
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Currency validation constraints and SECURITY DEFINER hardening
- [x] 08-02-PLAN.md — Invoice void cascade audit logging

#### Phase 9: Manual Stock-In Enhancement
**Goal**: Users can perform manual stock-in with currency selection and see EUSD calculations
**Depends on**: Phase 8
**Requirements**: STCK-01, STCK-02, STCK-03, STCK-04
**Success Criteria** (what must be TRUE):
  1. User can select currency (MMK, USD, other) for manual stock-in
  2. User can enter exchange rate with 4 decimal precision
  3. User sees real-time EUSD equivalent as they type amounts
  4. Manual stock-in unit cost factors into item WAC alongside invoice-based stock-in
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md — Add currency selection, exchange rate, and EUSD calculation to manual stock-in

#### Phase 10: Inventory Dashboard
**Goal**: Users can view comprehensive stock transaction history with KPIs and filters
**Depends on**: Phase 9
**Requirements**: INVD-01, INVD-02, INVD-03, INVD-04, INVD-05, INVD-06
**Success Criteria** (what must be TRUE):
  1. User can view paginated list of all stock in/out transactions
  2. User sees transaction count KPIs (total in, total out by period)
  3. User sees transaction value KPIs (total MMK and EUSD)
  4. User can filter transactions by date range
  5. User can filter transactions by warehouse
  6. User can toggle view between "All", "Stock In", and "Stock Out" groupings
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Database RPC + dashboard page with KPIs, tabs, and transaction table
- [x] 10-02-PLAN.md — Filter system with popover, chips, and URL persistence

#### Phase 11: Warehouse Detail Enhancement
**Goal**: Warehouse detail page displays per-item WAC with EUSD values
**Depends on**: Phase 10
**Requirements**: WHSE-01, WHSE-02
**Success Criteria** (what must be TRUE):
  1. Warehouse inventory tab shows per-item WAC (stock qty, WAC amount, total value)
  2. Warehouse inventory tab shows EUSD value per item
  3. User can see total warehouse value in EUSD
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Enhance inventory table with EUSD-only WAC display, zero-stock visibility, and low stock warnings

#### Phase 12: Invoice Void Cascade
**Goal**: Voiding invoices automatically updates all dependent financial and status calculations
**Depends on**: Phase 11
**Requirements**: VOID-01, VOID-02, VOID-03, VOID-04
**Success Criteria** (what must be TRUE):
  1. When user voids invoice, PO status badge updates immediately
  2. When user voids invoice, Balance in Hand reflects updated available budget
  3. When user voids invoice, PO line item "invoiced" quantities decrease correctly
  4. User can review audit trail showing all cascade effects (PO status change, Balance in Hand update, quantity changes)
**Plans**: TBD

Plans:
- [ ] 12-01: [TBD during planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 7.1 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. PO Creation Workflow Fix | v1.1 | 3/3 | Complete | 2026-01-28 |
| 2. Stock-In Functionality Fix | v1.1 | 3/3 | Complete | 2026-01-28 |
| 3. Invoice Quantity Validation | v1.1 | 2/2 | Complete | 2026-01-28 |
| 4. File Attachment System | v1.1 | 3/3 | Complete | 2026-01-28 |
| 5. Management Dashboard | v1.1 | 3/3 | Complete | 2026-01-28 |
| 6. Status & Transaction UX | v1.1 | 3/3 | Complete | 2026-01-28 |
| 7. UX Polish | v1.2 | 2/2 | Complete | 2026-01-29 |
| 7.1 Attachment & Item Route Fixes | v1.2 | 3/3 | Complete | 2026-01-29 |
| 8. Database Foundation | v1.2 | 2/2 | Complete | 2026-01-30 |
| 9. Manual Stock-In Enhancement | v1.2 | 1/1 | Complete | 2026-01-30 |
| 10. Inventory Dashboard | v1.2 | 2/2 | Complete | 2026-01-30 |
| 11. Warehouse Detail Enhancement | v1.2 | 0/1 | In progress | - |
| 12. Invoice Void Cascade | v1.2 | 0/0 | Not started | - |
