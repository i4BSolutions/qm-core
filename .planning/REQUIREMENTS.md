# Requirements: QM System

**Defined:** 2026-02-06
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.4 Requirements

Requirements for v1.4 UX Enhancements & Workflow Improvements. Each maps to roadmap phases.

### Attachments

- [x] **ATCH-01**: User can upload files when creating a QMRL (in create form)
- [ ] **ATCH-02**: User can delete attachments on QMRL detail page without errors
- [ ] **ATCH-03**: User can delete attachments on QMHQ detail page without errors

### QMHQ Workflow

- [x] **QMHQ-01**: User sees full QMRL detail in side panel when creating QMHQ

### Number Display

- [x] **NUMD-01**: Amount input fields display thousand separators
- [x] **NUMD-02**: Large amount values display responsively within containers

### Items

- [ ] **ITEM-01**: User can add price reference note when creating an item
- [ ] **ITEM-02**: Item price reference displays in PO line item selector
- [ ] **ITEM-03**: Item codes auto-generate as [CAT]-[NNNN] format from category

### PO Creation

- [ ] **POCR-01**: User can create new items inline during PO line item entry

### Multi-Tab

- [ ] **AUTH-01**: User can use system across multiple browser tabs without auth errors

### Contact Person

- [ ] **CONT-01**: Money-Out transactions (Expense route) require contact person
- [ ] **CONT-02**: PO route transactions require contact person

## Future Requirements

Deferred from original v1.4 PO Smart Lifecycle scope.

### PO Lifecycle

- **POLC-01**: PO status uses three-way match (PO qty = Invoice qty = Stock-in qty)
- **POLC-02**: Visual matching panel on PO detail page (side-by-side comparison)
- **POLC-03**: Progress bar showing completion percentage toward "Closed"
- **POLC-04**: Lock mechanism when PO status = Closed (block edits except Admin)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| PO Edit page creation | Tech debt - document PO as immutable after creation |
| Real-time WebSocket updates | Polling sufficient for current usage |
| File attachments on PO/Invoice | QMRL/QMHQ scope first |
| Per-item low stock thresholds | Global default (10) works |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATCH-01 | Phase 18 | Complete |
| ATCH-02 | Phase 17 | Complete |
| ATCH-03 | Phase 17 | Complete |
| QMHQ-01 | Phase 19 | Complete |
| NUMD-01 | Phase 20 | Complete |
| NUMD-02 | Phase 20 | Complete |
| ITEM-01 | Phase 21 | Pending |
| ITEM-02 | Phase 21 | Pending |
| ITEM-03 | Phase 21 | Pending |
| POCR-01 | Phase 22 | Pending |
| AUTH-01 | Phase 22 | Pending |
| CONT-01 | Phase 22 | Pending |
| CONT-02 | Phase 22 | Pending |

**Coverage:**
- v1.4 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 — Roadmap phases 17-22 assigned*
