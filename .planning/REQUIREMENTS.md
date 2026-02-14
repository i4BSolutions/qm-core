# Requirements: QM System

**Defined:** 2026-02-14
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.10 Requirements

Requirements for tech debt cleanup. Each maps to roadmap phases.

### PO Edit

- [ ] **POED-01**: User can edit PO header fields (supplier, currency, exchange rate, notes) from detail page
- [ ] **POED-02**: User can edit PO line items (add, remove, update quantities and prices)
- [ ] **POED-03**: PO edit is blocked when PO status is closed or cancelled (consistent with existing guards)

### Context Sliders

- [ ] **CSLR-01**: Stock-out approval page shows QMRL/QMHQ context slider with request details
- [ ] **CSLR-02**: Stock-out execution dialog shows relevant context (item, warehouse, quantities)

### Flow Tracking Performance

- [ ] **FLOW-01**: Flow tracking page loads within acceptable time for production data volumes
- [ ] **FLOW-02**: Flow tracking VIEW has appropriate indexes for common query patterns

### Type Safety

- [ ] **TYPE-01**: Composite component props tightened from ReactNode to string where only strings are used
- [ ] **TYPE-02**: Composite components retain ReactNode for props that genuinely need rich content

## Future Requirements

None — tech debt milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| PO deletion | Soft delete pattern established; void/cancel is the mechanism |
| PO version history / diff | Audit log already captures changes |
| Materialized view for flow tracking | Only if VIEW performance proves insufficient after indexing |
| Full composite component rewrite | Only tighten prop types, no structural changes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| POED-01 | TBD | Pending |
| POED-02 | TBD | Pending |
| POED-03 | TBD | Pending |
| CSLR-01 | TBD | Pending |
| CSLR-02 | TBD | Pending |
| FLOW-01 | TBD | Pending |
| FLOW-02 | TBD | Pending |
| TYPE-01 | TBD | Pending |
| TYPE-02 | TBD | Pending |

**Coverage:**
- v1.10 requirements: 9 total
- Mapped to phases: 0
- Unmapped: 9 (pending roadmap creation)

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
