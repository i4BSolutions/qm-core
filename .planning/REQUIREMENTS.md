# Requirements: QM System

**Defined:** 2026-01-28
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.2 Requirements

Requirements for Inventory & Financial Accuracy milestone.

### UX Consistency

- [x] **UX-01**: Transaction date picker (money in/out) displays DD/MM/YYYY format matching system standard
- [x] **UX-02**: Number input fields (amount, exchange rate, quantity) use empty placeholder instead of default values, allowing direct typing
- [x] **UX-03**: Number input fields validate to prevent negative values and zero where inappropriate (amounts, quantities, exchange rates)

### Inventory Dashboard

- [ ] **INVD-01**: User can view stock in/out transaction list
- [ ] **INVD-02**: User can see transaction count KPIs (total in, total out by period)
- [ ] **INVD-03**: User can see transaction value KPIs (total MMK and EUSD)
- [ ] **INVD-04**: User can filter transactions by date range
- [ ] **INVD-05**: User can filter transactions by warehouse
- [ ] **INVD-06**: User can view transactions grouped by type (in vs out)

### Warehouse Detail

- [ ] **WHSE-01**: User can see per-item WAC display (stock qty, WAC amount, total value)
- [ ] **WHSE-02**: User can see EUSD value per item in warehouse

### Manual Stock-In

- [x] **STCK-01**: User can select currency for manual stock-in
- [x] **STCK-02**: User can enter exchange rate (4 decimal places) for manual stock-in
- [x] **STCK-03**: User can see EUSD equivalent calculated from amount and exchange rate
- [x] **STCK-04**: Manual stock-in unit cost factors into item WAC calculation

### Invoice Void Cascade

- [ ] **VOID-01**: When invoice is voided, PO status is automatically recalculated
- [ ] **VOID-02**: When invoice is voided, Balance in Hand is automatically updated
- [ ] **VOID-03**: When invoice is voided, invoiced quantities are recalculated
- [ ] **VOID-04**: When invoice is voided, all cascade effects are logged to audit trail

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
| INVD-01 | Phase 10 | Pending |
| INVD-02 | Phase 10 | Pending |
| INVD-03 | Phase 10 | Pending |
| INVD-04 | Phase 10 | Pending |
| INVD-05 | Phase 10 | Pending |
| INVD-06 | Phase 10 | Pending |
| WHSE-01 | Phase 11 | Pending |
| WHSE-02 | Phase 11 | Pending |
| STCK-01 | Phase 9 | Complete |
| STCK-02 | Phase 9 | Complete |
| STCK-03 | Phase 9 | Complete |
| STCK-04 | Phase 9 | Complete |
| VOID-01 | Phase 12 | Pending |
| VOID-02 | Phase 12 | Pending |
| VOID-03 | Phase 12 | Pending |
| VOID-04 | Phase 12 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

**Phase Distribution:**
- Phase 7 (UX Polish): 3 requirements
- Phase 8 (Database Foundation): 0 direct requirements (enables STCK-04, VOID-01-04)
- Phase 9 (Manual Stock-In Enhancement): 4 requirements
- Phase 10 (Inventory Dashboard): 6 requirements
- Phase 11 (Warehouse Detail Enhancement): 2 requirements
- Phase 12 (Invoice Void Cascade): 4 requirements

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-30 — Phase 9 requirements STCK-01 through STCK-04 complete*
