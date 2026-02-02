# Roadmap: QM System

## Milestones

- **v1.0 MVP** - Foundation (shipped pre-existing)
- **v1.1 Enhancement** - Phases 1-6 (shipped 2026-01-28)
- **v1.2 Inventory & Financial Accuracy** - Phases 7-12 (shipped 2026-01-31)
- **v1.3 UX & Bug Fixes** - Phases 13-16 (shipped 2026-02-02)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 7.1 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16

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
