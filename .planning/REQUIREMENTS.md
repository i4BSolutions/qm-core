# Requirements: QM System

**Defined:** 2026-01-28
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.3 Requirements

Requirements for UX & Bug Fixes milestone.

### Attachment Management

- [x] **ATCH-01**: Users can delete their own file attachments from QMRL/QMHQ detail pages
- [x] **ATCH-02**: Admin and Quartermaster can delete any file attachment

### Number Input Behavior

- [x] **NINP-01**: Number input fields preserve typed value on blur (no auto-formatting during edit)
- [x] **NINP-02**: Number inputs accept empty string, show blank when empty (not "0")
- [x] **NINP-03**: Amount fields format to 2 decimal places only on submit
- [x] **NINP-04**: Exchange rate fields format to 4 decimal places only on submit

### Currency Display

- [x] **CURR-01**: Financial amounts display original currency value
- [x] **CURR-02**: EUSD equivalent shown alongside original currency (not MMK)
- [x] **CURR-03**: Consistent currency formatting across all entity views (QMRL, QMHQ, PO, Invoice, Inventory)

### Status History

- [x] **HIST-01**: Status change notes appear in History tab with the status change entry
- [x] **HIST-02**: Audit log captures user-entered reason/notes for status changes

### QMHQ Item Route Fulfillment

- [x] **FULF-01**: QMHQ item route stock-out only available from QMHQ detail page (not general stock-out)
- [x] **FULF-02**: Stock-out enforces maximum quantity (cannot exceed requested qty minus already fulfilled)
- [x] **FULF-03**: QMHQ detail shows fulfillment progress (fulfilled qty vs requested qty)

### Edit Capability

- [x] **EDIT-01**: QMRL detail page has Edit button routing to edit form
- [x] **EDIT-02**: QMHQ detail page has Edit button routing to edit form
- [x] **EDIT-03**: PO detail page has Edit button routing to edit form (if not closed)
- [x] **EDIT-04**: Invoice detail page shows view-only (no edit, void instead)

---

## v1.2 Requirements (Complete)

Requirements for Inventory & Financial Accuracy milestone.

### UX Consistency

- [x] **UX-01**: Transaction date picker (money in/out) displays DD/MM/YYYY format matching system standard
- [x] **UX-02**: Number input fields (amount, exchange rate, quantity) use empty placeholder instead of default values, allowing direct typing
- [x] **UX-03**: Number input fields validate to prevent negative values and zero where inappropriate (amounts, quantities, exchange rates)

### Inventory Dashboard

- [x] **INVD-01**: User can view stock in/out transaction list
- [x] **INVD-02**: User can see transaction count KPIs (total in, total out by period)
- [x] **INVD-03**: User can see transaction value KPIs (total MMK and EUSD)
- [x] **INVD-04**: User can filter transactions by date range
- [x] **INVD-05**: User can filter transactions by warehouse
- [x] **INVD-06**: User can view transactions grouped by type (in vs out)

### Warehouse Detail

- [x] **WHSE-01**: User can see per-item WAC display (stock qty, WAC amount, total value)
- [x] **WHSE-02**: User can see EUSD value per item in warehouse

### Manual Stock-In

- [x] **STCK-01**: User can select currency for manual stock-in
- [x] **STCK-02**: User can enter exchange rate (4 decimal places) for manual stock-in
- [x] **STCK-03**: User can see EUSD equivalent calculated from amount and exchange rate
- [x] **STCK-04**: Manual stock-in unit cost factors into item WAC calculation

### Invoice Void Cascade

- [x] **VOID-01**: When invoice is voided, PO status is automatically recalculated
- [x] **VOID-02**: When invoice is voided, Balance in Hand is automatically updated
- [x] **VOID-03**: When invoice is voided, invoiced quantities are recalculated
- [x] **VOID-04**: When invoice is voided, all cascade effects are logged to audit trail

## Future Requirements

Deferred to later milestones.

### Analytics & Reporting

- **ANLY-01**: Stock movement trends over time
- **ANLY-02**: Inventory velocity calculations
- **ANLY-03**: CSV export of transaction history

### Enhanced Filtering

- **FILT-01**: Filter transactions by user
- **FILT-02**: Filter transactions by reason (consumption, damage, transfer, etc.)
- **FILT-03**: Filter transactions by source entity (invoice, manual, PO)

### Warehouse Enhancements

- **WHSE-03**: Per-item stock movement history from warehouse detail
- **WHSE-04**: Dedicated inter-warehouse transfer view
- **WHSE-05**: Item reorder suggestions based on consumption

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Transaction editing after creation | Breaks audit integrity |
| Real-time WebSocket dashboard updates | Polling sufficient, adds complexity |
| Per-item low stock thresholds | Global threshold (10 units) works |
| Manual WAC adjustment | Invites manipulation, breaks traceability |
| Transaction deletion | Audit trail gaps, regulatory issues |
| Batch transaction editing | Complex UI, high error risk |
| Custom dashboard layouts | Maintenance burden, role-based views sufficient |
| Stock alerts via email/SMS | In-dashboard alerts sufficient for internal tool |
| Predictive inventory analytics | Get visibility right first, consider v2+ |
| Stock-in reversal on invoice void | Voided invoice adjusts financials only, not physical stock |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 7 | Complete |
| UX-02 | Phase 7 | Complete |
| UX-03 | Phase 7 | Complete |
| INVD-01 | Phase 10 | Complete |
| INVD-02 | Phase 10 | Complete |
| INVD-03 | Phase 10 | Complete |
| INVD-04 | Phase 10 | Complete |
| INVD-05 | Phase 10 | Complete |
| INVD-06 | Phase 10 | Complete |
| WHSE-01 | Phase 11 | Complete |
| WHSE-02 | Phase 11 | Complete |
| STCK-01 | Phase 9 | Complete |
| STCK-02 | Phase 9 | Complete |
| STCK-03 | Phase 9 | Complete |
| STCK-04 | Phase 9 | Complete |
| VOID-01 | Phase 12 | Complete |
| VOID-02 | Phase 12 | Complete |
| VOID-03 | Phase 12 | Complete |
| VOID-04 | Phase 12 | Complete |

### v1.3 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATCH-01 | Phase 13 | Complete |
| ATCH-02 | Phase 13 | Complete |
| NINP-01 | Phase 14 | Complete |
| NINP-02 | Phase 14 | Complete |
| NINP-03 | Phase 14 | Complete |
| NINP-04 | Phase 14 | Complete |
| CURR-01 | Phase 14 | Complete |
| CURR-02 | Phase 14 | Complete |
| CURR-03 | Phase 14 | Complete |
| HIST-01 | Phase 16 | Complete |
| HIST-02 | Phase 16 | Complete |
| FULF-01 | Phase 13 | Complete |
| FULF-02 | Phase 13 | Complete |
| FULF-03 | Phase 13 | Complete |
| EDIT-01 | Phase 15 | Complete |
| EDIT-02 | Phase 15 | Complete |
| EDIT-03 | Phase 15 | Complete |
| EDIT-04 | Phase 15 | Complete |

**v1.2 Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Complete: 19

**v1.3 Coverage:**
- v1.3 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

**v1.3 Phase Distribution:**
- Phase 13 (Verification & Fixes): 5 requirements (ATCH-01, ATCH-02, FULF-01, FULF-02, FULF-03)
- Phase 14 (Currency & Number Input Standardization): 7 requirements (NINP-01-04, CURR-01-03)
- Phase 15 (Edit Capability): 4 requirements (EDIT-01-04)
- Phase 16 (Audit Notes Feature): 2 requirements (HIST-01, HIST-02)

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-02-02 — v1.3 milestone complete*
