# Roadmap: QM System

## Milestones

- **v1.0 MVP** - Foundation (shipped pre-existing)
- **v1.1 Enhancement** - Phases 1-6 (shipped 2026-01-28)
- **v1.2 Inventory & Financial Accuracy** - Phases 7-12 (shipped 2026-01-31)
- **v1.3 UX & Bug Fixes** - Phases 13-16 (current)

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

### v1.3 UX & Bug Fixes (Current)

**Milestone Goal:** Users experience consistent input behavior, standardized currency display, and can edit entities from detail pages while status change notes are properly captured in audit history.

#### Phase 13: Verification & Quick Fixes
**Goal**: Verify already-deployed features work correctly and fix any gaps in attachment deletion and QMHQ fulfillment
**Depends on**: Phase 12
**Requirements**: ATCH-01, ATCH-02, FULF-01, FULF-02, FULF-03
**Success Criteria** (what must be TRUE):
  1. User who uploaded an attachment can delete it from QMRL/QMHQ detail page
  2. Admin and Quartermaster can delete any attachment regardless of uploader
  3. QMHQ item route stock-out is only accessible from QMHQ detail page (not general stock-out form)
  4. Stock-out quantity cannot exceed remaining unfulfilled quantity (requested minus already issued)
  5. QMHQ detail page shows fulfillment progress indicator (e.g., "5/10 fulfilled")
**Plans**: 2 plans (completed)
Plans:
- [x] 13-01-PLAN.md - Fix attachment delete permission UI to match RLS policy
- [x] 13-02-PLAN.md - Add fulfillment progress tracking and stock-out restrictions

**Notes**: Research indicates RLS policy (migration 037) and stock-out tab (QMHQ detail lines 712-837) already exist. This phase verifies functionality and addresses any gaps.

#### Phase 14: Currency & Number Input Standardization
**Goal**: Number inputs preserve user-typed values and currency displays show original value with EUSD equivalent
**Depends on**: Phase 13
**Requirements**: NINP-01, NINP-02, NINP-03, NINP-04, CURR-01, CURR-02, CURR-03
**Success Criteria** (what must be TRUE):
  1. Typing a number and clicking away preserves the exact typed value (no auto-formatting on blur)
  2. Empty number inputs show placeholder text (not "0" or "0.00")
  3. Amount fields format to 2 decimal places only when form is submitted
  4. Exchange rate fields format to 4 decimal places only when form is submitted
  5. Financial amounts display original currency value (USD, THB, etc.) not converted to MMK
  6. EUSD equivalent appears alongside original currency in all financial displays
  7. Currency formatting is consistent across QMRL, QMHQ, PO, Invoice, and Inventory views
**Plans**: 7 plans
Plans:
- [ ] 14-01-PLAN.md - Create number input utilities (keydown handlers, validators)
- [ ] 14-02-PLAN.md - Create CurrencyDisplay component for two-line format
- [ ] 14-03-PLAN.md - Update inventory and QMHQ forms with number input handlers
- [ ] 14-04-PLAN.md - Update PO and Invoice forms with number input handlers
- [ ] 14-05-PLAN.md - Update card components and list pages with CurrencyDisplay
- [ ] 14-06-PLAN.md - Update QMHQ, PO, Invoice detail pages with CurrencyDisplay
- [ ] 14-07-PLAN.md - Update warehouse, item, QMRL detail pages with CurrencyDisplay

**Notes**: Wave 1 (parallel): Plans 01, 02. Wave 2 (parallel): Plans 03, 04, 05. Wave 3 (parallel): Plans 06, 07.

#### Phase 15: Edit Capability
**Goal**: Users can edit entities directly from their detail pages
**Depends on**: Phase 14
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04
**Success Criteria** (what must be TRUE):
  1. QMRL detail page has Edit button that routes to the edit form
  2. QMHQ detail page has Edit button that routes to the edit form
  3. PO detail page has Edit button that routes to the edit form (hidden when PO is closed)
  4. Invoice detail page shows view-only with no Edit button (void functionality exists instead)
**Plans**: TBD

**Notes**: Edit forms already exist for all entities. This phase adds navigation buttons and respects entity state (closed PO, voided invoice).

#### Phase 16: Audit Notes Feature
**Goal**: Status change notes are captured in audit log and displayed in History tab
**Depends on**: Phase 15
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. When user changes status with a note, the note appears in the History tab entry
  2. Audit log records include user-entered reason/notes for status changes
  3. Status changes without notes still appear in History (notes field empty is acceptable)
  4. No duplicate audit entries when status is changed (trigger deduplication works)
**Plans**: TBD

**Notes**: Requires UI to pass notes through status update flow. Trigger modification needed for deduplication. Test for race conditions with rapid status changes.

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
| 14. Currency & Number Input Standardization | v1.3 | 0/7 | Pending | - |
| 15. Edit Capability | v1.3 | 0/? | Pending | - |
| 16. Audit Notes Feature | v1.3 | 0/? | Pending | - |
