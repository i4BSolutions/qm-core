# Roadmap: QM System

## Milestones

- **v1.0 MVP** - Foundation (shipped pre-existing)
- **v1.1 Enhancement** - Phases 1-6 (shipped 2026-01-28)
- **v1.2 Inventory & Financial Accuracy** - Phases 7-12 (shipped 2026-01-31)
- **v1.3 UX & Bug Fixes** - Phases 13-16 (shipped 2026-02-02)
- **v1.4 PO Smart Lifecycle** - Phases 17-19 (in progress)

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

<details>
<summary>v1.2 Inventory & Financial Accuracy (Phases 7-12) - SHIPPED 2026-01-31</summary>

### Phase 7: UX Polish
**Goal**: Number inputs and date pickers work consistently across all transaction forms
**Depends on**: Phase 6
**Requirements**: UX-01, UX-02, UX-03
**Plans**: 2 plans (completed)

### Phase 7.1: Attachment & Item Route Fixes (INSERTED)
**Goal**: Fix attachment deletion and enhance QMHQ item route with multi-item stock-out capability
**Depends on**: Phase 7
**Requirements**: Urgent fixes discovered post-Phase 7
**Plans**: 3 plans (completed)

### Phase 8: Database Foundation
**Goal**: Database layer supports currency-aware WAC calculation and invoice void cascades
**Depends on**: Phase 7.1
**Requirements**: Enables STCK-04, VOID-01, VOID-02, VOID-03, VOID-04
**Plans**: 2 plans (completed)

### Phase 9: Manual Stock-In Enhancement
**Goal**: Users can perform manual stock-in with currency selection and see EUSD calculations
**Depends on**: Phase 8
**Requirements**: STCK-01, STCK-02, STCK-03, STCK-04
**Plans**: 1 plan (completed)

### Phase 10: Inventory Dashboard
**Goal**: Users can view comprehensive stock transaction history with KPIs and filters
**Depends on**: Phase 9
**Requirements**: INVD-01, INVD-02, INVD-03, INVD-04, INVD-05, INVD-06
**Plans**: 2 plans (completed)

### Phase 11: Warehouse Detail Enhancement
**Goal**: Warehouse detail page displays per-item WAC with EUSD values
**Depends on**: Phase 10
**Requirements**: WHSE-01, WHSE-02
**Plans**: 1 plan (completed)

### Phase 12: Invoice Void Cascade
**Goal**: Voiding invoices triggers immediate UI feedback showing cascade effects
**Depends on**: Phase 11
**Requirements**: VOID-01, VOID-02, VOID-03, VOID-04
**Plans**: 1 plan (completed)

</details>

<details>
<summary>v1.3 UX & Bug Fixes (Phases 13-16) - SHIPPED 2026-02-02</summary>

### Phase 13: Verification & Quick Fixes
**Goal**: Verify attachment deletion and QMHQ fulfillment features work correctly
**Plans**: 2 plans (completed)

### Phase 14: Currency & Number Input Standardization
**Goal**: Number inputs preserve user-typed values and currency displays show original value with EUSD equivalent
**Plans**: 7 plans (completed)

### Phase 15: Edit Capability
**Goal**: Users can edit entities directly from their detail pages with permission-based visibility
**Plans**: 1 plan (completed)

### Phase 16: Audit Notes Feature
**Goal**: Status change notes are captured in audit log and displayed in History tab
**Plans**: 1 plan (completed)

</details>

### v1.4 PO Smart Lifecycle (In Progress)

**Milestone Goal:** PO status accurately reflects three-way match state (PO qty = Invoice qty = Stock-in qty) with visual lifecycle components and lock enforcement when Closed.

#### Phase 17: Complete Three-Way Match Calculation
**Goal**: Stock-in triggers cascade to update received_quantity on invoice and PO lines, enabling accurate PO status calculation
**Depends on**: Phase 16
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, SR-01, SR-02, SR-03, SR-04, SR-05, SR-06
**Success Criteria** (what must be TRUE):
  1. Stock-in transaction automatically updates invoice_line_items.received_quantity for the linked invoice line
  2. Invoice line update cascades to update po_line_items.received_quantity
  3. PO status transitions correctly through Not Started -> Partially Invoiced -> Awaiting Delivery -> Partially Received -> Closed based on three-way match state
  4. Voided invoices are excluded from all matching calculations (PO status, quantities)
  5. Concurrent stock-in operations do not cause race conditions or incorrect status
**Plans**: TBD

#### Phase 18: Visual Matching Panel
**Goal**: Users can see side-by-side comparison of PO vs Invoice vs Stock-in quantities on PO detail page
**Depends on**: Phase 17
**Requirements**: VMP-01, VMP-02, VMP-03, VMP-04, VMP-05, VMP-06
**Success Criteria** (what must be TRUE):
  1. PO detail page displays three-column matching panel (PO qty | Invoiced qty | Received qty)
  2. Each PO line item shows its matching detail with expandable accordion
  3. User can see "Available to Invoice" quantity (Ordered - Already Invoiced)
  4. Multiple partial invoices against same PO line are shown with individual quantities
  5. Color coding visually distinguishes invoiced (amber) vs received (emerald) quantities
**Plans**: TBD

#### Phase 19: Progress Bar & Lock Indicators
**Goal**: Visual progress toward Closed status and lock enforcement when PO is Closed
**Depends on**: Phase 17
**Requirements**: PB-01, PB-02, PB-03, PB-04, LM-01, LM-02, LM-03, LM-04, LM-05, LM-06
**Success Criteria** (what must be TRUE):
  1. Progress bar shows percentage completion toward Closed status with dual bars (invoiced % and received %)
  2. Progress bar includes legend explaining bar segments
  3. Closed PO displays lock indicator badge and alert banner explaining locked state
  4. Closed PO cannot be edited at database level (trigger enforcement, not just UI)
  5. Admin can reopen a Closed PO with required reason that is captured in audit log
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 18 -> 19 (Note: 18 and 19 can execute in parallel after 17)

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
| 11. Warehouse Detail Enhancement | v1.2 | 1/1 | Complete | 2026-01-30 |
| 12. Invoice Void Cascade | v1.2 | 1/1 | Complete | 2026-01-31 |
| 13. Verification & Quick Fixes | v1.3 | 2/2 | Complete | 2026-02-02 |
| 14. Currency & Number Input Standardization | v1.3 | 7/7 | Complete | 2026-02-02 |
| 15. Edit Capability | v1.3 | 1/1 | Complete | 2026-02-02 |
| 16. Audit Notes Feature | v1.3 | 1/1 | Complete | 2026-02-02 |
| 17. Complete Three-Way Match Calculation | v1.4 | 0/TBD | Not Started | - |
| 18. Visual Matching Panel | v1.4 | 0/TBD | Not Started | - |
| 19. Progress Bar & Lock Indicators | v1.4 | 0/TBD | Not Started | - |
