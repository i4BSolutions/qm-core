# Requirements: QM System

**Defined:** 2026-02-11
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.7 Requirements

Requirements for v1.7 Stock-Out Request Logic Repair. Each maps to roadmap phases.

### Execution

- [ ] **EXEC-01**: Each approved stock-out line item has its own Execute button (independent of other items)
- [ ] **EXEC-02**: Executing one line item does not affect other approved items in the same request

### Transaction Linking

- [ ] **LINK-01**: Stock-out approval propagates qmhq_id to inventory transactions
- [ ] **LINK-02**: QMHQ item detail shows linked stock-out transactions (via QMHQ → SOR → execution)

### Reference Display

- [ ] **REF-01**: Stock-out transactions show SOR ID as primary reference
- [ ] **REF-02**: Stock-out transactions show parent QMHQ ID as secondary reference with clickable link

### QMHQ Metrics

- [ ] **METRIC-01**: QMHQ item detail shows requested qty (from SOR line items)
- [ ] **METRIC-02**: QMHQ item detail shows approved qty (from approvals)
- [ ] **METRIC-03**: QMHQ item detail shows rejected qty (from rejections)
- [ ] **METRIC-04**: QMHQ item detail shows executed/fulfilled qty (from stock-out transactions)
- [ ] **METRIC-05**: Fulfillment Progress calculates as executed qty / approved qty
- [ ] **METRIC-06**: Requested qty is visible alongside the fulfillment progress

## Future Requirements

None — focused repair milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Batch "Execute All" button | Per-line-item execution is the goal; batch can be added later |
| Real-time subscription for execution status | Query invalidation sufficient for internal tool |
| Advisory lock performance tuning | Defer until 10K+ SORs/month |
| Context slider on execution dialog | Execution is a small dialog, not a standalone page |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| LINK-01 | — | Pending |
| LINK-02 | — | Pending |
| REF-01 | — | Pending |
| REF-02 | — | Pending |
| METRIC-01 | — | Pending |
| METRIC-02 | — | Pending |
| METRIC-03 | — | Pending |
| METRIC-04 | — | Pending |
| METRIC-05 | — | Pending |
| METRIC-06 | — | Pending |

**Coverage:**
- v1.7 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 (pending roadmap creation)

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after initial definition*
