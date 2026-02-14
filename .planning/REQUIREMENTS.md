# Requirements: QM System

**Defined:** 2026-02-14
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.10 Requirements

Requirements for tech debt cleanup. Each maps to roadmap phases.

### PO Edit

- [x] **POED-01**: User can edit PO header fields (supplier, notes, expected delivery date) from detail page — line items, amounts, currency, and exchange rate are not editable
- [x] **POED-02**: PO edit is blocked when PO status is closed or cancelled (consistent with existing guards)

### Flow Tracking Performance

- [x] **FLOW-01**: Flow tracking page loads within acceptable time for production data volumes
- [x] **FLOW-02**: Flow tracking VIEW has appropriate indexes for common query patterns

### Type Safety

- [x] **TYPE-01**: Composite component props tightened from ReactNode to string where only strings are used
- [x] **TYPE-02**: Composite components retain ReactNode for props that genuinely need rich content

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
| POED-01 | Phase 44 | ✓ Satisfied |
| POED-02 | Phase 44 | ✓ Satisfied |
| FLOW-01 | Phase 45 | ✓ Satisfied |
| FLOW-02 | Phase 45 | ✓ Satisfied |
| TYPE-01 | Phase 46 | ✓ Satisfied |
| TYPE-02 | Phase 46 | ✓ Satisfied |

**Coverage:**
- v1.10 requirements: 6 total
- Mapped to phases: 6 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after v1.10 milestone audit*
