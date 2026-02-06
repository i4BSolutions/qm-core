# Roadmap: QM System

## Milestones

- **v1.0 MVP** - Foundation (shipped pre-existing)
- **v1.1 Enhancement** - Phases 1-6 (shipped 2026-01-28)
- **v1.2 Inventory & Financial Accuracy** - Phases 7-12 (shipped 2026-01-31)
- **v1.3 UX & Bug Fixes** - Phases 13-16 (shipped 2026-02-02)
- **v1.4 UX Enhancements & Workflow Improvements** - Phases 17-22 (in progress)

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

<details open>
<summary>v1.4 UX Enhancements & Workflow Improvements (Phases 17-22) - IN PROGRESS</summary>

### Phase 17: Attachment Delete Fixes ✓
**Goal**: Users can delete attachments on QMRL and QMHQ detail pages without errors
**Depends on**: Phase 16
**Requirements**: ATCH-02, ATCH-03
**Plans**: 1 plan (completed)

Plans:
- [x] 17-01-PLAN.md - Fix deleteFile query pattern (fetch before update)

**Success Criteria:**
1. ✓ User can delete own attachment on QMRL detail page without RLS or database errors
2. ✓ User can delete own attachment on QMHQ detail page without RLS or database errors
3. ✓ Admin/Quartermaster can delete any attachment on both pages without errors
4. ✓ Deleted attachments are removed from UI immediately after successful deletion

### Phase 18: QMRL Create Attachments
**Goal**: Users can upload files during QMRL creation before the entity is saved
**Depends on**: Phase 17
**Requirements**: ATCH-01
**Plans**: 1 plan

Plans:
- [ ] 18-01-PLAN.md - Staged file upload with Upload-After-Create pattern

**Success Criteria:**
1. User sees file upload area in QMRL create form
2. User can select and preview files before submitting form
3. Files are uploaded and linked to QMRL after entity creation succeeds
4. Failed file uploads do not block QMRL creation (graceful degradation)

### Phase 19: QMHQ Creation Workflow Enhancement
**Goal**: Users see full QMRL context when creating QMHQ without leaving the creation flow
**Depends on**: Phase 17
**Requirements**: QMHQ-01

**Success Criteria:**
1. User sees side panel showing QMRL details when creating QMHQ
2. Side panel displays QMRL title, description, status, category, and key fields
3. Side panel remains visible throughout multi-step QMHQ creation
4. Panel can be collapsed/expanded without losing QMHQ form state

### Phase 20: Number Display Formatting
**Goal**: Financial amounts display with thousand separators and fit within containers
**Depends on**: Phase 17
**Requirements**: NUMD-01, NUMD-02

**Success Criteria:**
1. Amount input fields show thousand separators as user types (1000 -> 1,000)
2. Separators are stripped before form submission (clean numeric values)
3. Large amounts (millions/billions) display responsively without overflow
4. Currency display components handle long values without breaking layout

### Phase 21: Item Enhancements
**Goal**: Items support price reference notes and auto-generated codes based on category
**Depends on**: Phase 20
**Requirements**: ITEM-01, ITEM-02, ITEM-03

**Success Criteria:**
1. User can enter price reference note when creating/editing an item
2. Price reference displays in PO line item selector for informed selection
3. Item codes auto-generate as [CAT]-[NNNN] format when category is selected
4. Auto-generated code can be overridden by user if needed
5. Code uniqueness is validated before item creation

### Phase 22: PO Inline Item Creation & Validation
**Goal**: Users can create new items inline during PO entry and contact person is enforced for financial routes
**Depends on**: Phase 21
**Requirements**: POCR-01, AUTH-01, CONT-01, CONT-02

**Success Criteria:**
1. User can create new item inline from PO line item selector without leaving PO form
2. Newly created item immediately appears in selector and can be added to PO
3. User can work across multiple browser tabs without authentication errors
4. Money-Out transactions (Expense route) require contact person before save
5. PO route transactions require contact person before save

</details>

## Progress

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
| 17. Attachment Delete Fixes | v1.4 | 1/1 | Complete | 2026-02-06 |
| 18. QMRL Create Attachments | v1.4 | 0/1 | Pending | — |
| 19. QMHQ Creation Workflow Enhancement | v1.4 | 0/? | Pending | — |
| 20. Number Display Formatting | v1.4 | 0/? | Pending | — |
| 21. Item Enhancements | v1.4 | 0/? | Pending | — |
| 22. PO Inline Item Creation & Validation | v1.4 | 0/? | Pending | — |
