# Requirements: QM System

**Defined:** 2026-02-14
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.11 Requirements

Requirements for Standard Unit System. Each maps to roadmap phases.

### Configuration

- [ ] **SCONF-01**: Admin can set the global standard unit name in admin settings page
- [ ] **SCONF-02**: Admin-configured standard unit name appears next to every standard quantity display

### Conversion Input

- [ ] **SINP-01**: User can input unit conversion rate per PO line item during PO creation
- [ ] **SINP-02**: User can input unit conversion rate per invoice line item during invoice creation
- [ ] **SINP-03**: User can input unit conversion rate when creating a stock-in transaction
- [ ] **SINP-04**: User can input unit conversion rate per stock-out request line item
- [ ] **SINP-05**: Unit conversion rate is required on all quantity inputs (no default value)

### Standard Unit Display

- [ ] **SDISP-01**: PO detail page shows standard qty (qty × rate) on each line item
- [ ] **SDISP-02**: Invoice detail page shows standard qty on each line item
- [ ] **SDISP-03**: Inventory transaction lists show standard qty alongside quantity
- [ ] **SDISP-04**: Warehouse detail page shows standard qty on inventory rows
- [ ] **SDISP-05**: QMHQ item detail shows standard qty on stock-out displays
- [ ] **SDISP-06**: Standard qty display uses two-line format matching CurrencyDisplay pattern
- [ ] **SDISP-07**: Existing transactions display with standard qty (backfilled with rate = 1)

## Future Requirements

### Standard Unit Extensions

- **SEXT-01**: WAC per standard unit display (WAC / conversion_rate)
- **SEXT-02**: Aggregate standard units on inventory and management dashboards

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-item unit name field | User decided: no unit tracking on items, just conversion rate per transaction |
| Fixed per-item conversion rate | User decided: per-transaction rate like exchange rate, not fixed per item |
| Default conversion rate value | User decided: required input with no default, user must enter every time |
| Unit name per transaction | No unit text field — just numeric rate and calculated standard qty |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCONF-01 | — | Pending |
| SCONF-02 | — | Pending |
| SINP-01 | — | Pending |
| SINP-02 | — | Pending |
| SINP-03 | — | Pending |
| SINP-04 | — | Pending |
| SINP-05 | — | Pending |
| SDISP-01 | — | Pending |
| SDISP-02 | — | Pending |
| SDISP-03 | — | Pending |
| SDISP-04 | — | Pending |
| SDISP-05 | — | Pending |
| SDISP-06 | — | Pending |
| SDISP-07 | — | Pending |

**Coverage:**
- v1.11 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
