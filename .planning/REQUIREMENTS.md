# Requirements: QM System v1.6

**Defined:** 2026-02-09
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.6 Requirements

Requirements for v1.6 Stock-Out Approval & Data Integrity milestone. Each maps to roadmap phases.

### Stock-Out Approval

- [ ] **SOAR-01**: User can create stock-out request with item, quantity, warehouse, reason, and notes
- [ ] **SOAR-02**: QMHQ item route stock-out request defaults quantity from QMHQ requested qty
- [ ] **SOAR-03**: Manual stock-out request submitted by Inventory or Quartermaster role
- [ ] **SOAR-04**: Stock-out request status tracks as Pending, Approved, or Rejected
- [ ] **SOAR-05**: Admin can approve stock-out request with approval quantity (<= requested)
- [ ] **SOAR-06**: Admin can reject stock-out request with rejection reason
- [ ] **SOAR-07**: Requester can cancel own pending stock-out request
- [ ] **SOAR-08**: QMHQ item detail shows requested qty and approved qty
- [ ] **SOAR-09**: Stock-out can only execute after approval (max = approved qty)
- [ ] **SOAR-10**: Stock validation checks available stock at both request and approval time
- [ ] **SOAR-11**: All stock-out request state changes logged in audit trail

### Deletion Protection

- [ ] **DPRT-01**: Item cannot be deactivated when referenced by QMHQ, PO line items, or inventory transactions
- [ ] **DPRT-02**: Status cannot be deactivated when assigned to any QMRL or QMHQ
- [ ] **DPRT-03**: Category cannot be deactivated when assigned to any QMRL, QMHQ, or item
- [ ] **DPRT-04**: Department cannot be deactivated when assigned to any user or QMRL
- [ ] **DPRT-05**: Contact person cannot be deactivated when referenced by any QMRL or QMHQ
- [ ] **DPRT-06**: Supplier cannot be deactivated when referenced by any PO
- [ ] **DPRT-07**: Delete attempt on referenced entity shows generic error "Cannot delete: this item is in use"

### User Management

- [ ] **UMGT-01**: Admin can deactivate a user account (no hard delete)
- [ ] **UMGT-02**: Deactivated user cannot log in to the system
- [ ] **UMGT-03**: Admin can reactivate a previously deactivated user

### Context Slider

- [ ] **CSLR-01**: Stock-out request page shows related QMRL and QMHQ info in right side slider
- [ ] **CSLR-02**: Stock-out approval page shows related QMRL and QMHQ info in right side slider
- [ ] **CSLR-03**: Stock-out execution page shows related QMRL and QMHQ info in right side slider
- [ ] **CSLR-04**: QMHQ create page shows related QMRL data in right side slider
- [ ] **CSLR-05**: Side slider is open by default and toggleable to close

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Stock-Out Enhancements

- **SOAR-12**: Batch approval UI for multiple pending requests
- **SOAR-13**: Auto-approval for quantities below configurable threshold
- **SOAR-14**: Priority/urgency levels on stock-out requests
- **SOAR-15**: Request expiration after configurable number of days

### Deletion Enhancements

- **DPRT-08**: Show specific references blocking deletion (e.g., "Used in PO-2025-00003")
- **DPRT-09**: Suggest reassignment before deletion

### User Management Enhancements

- **UMGT-04**: Reassign open tasks before deactivation
- **UMGT-05**: Bulk user deactivation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-level approval chains | Single-tier admin approval sufficient for internal tool |
| Stock reservation on request creation | Adds complexity; internal tool doesn't need overselling prevention |
| Approval delegation to non-admin roles | Permission complexity; keep admin-only for now |
| Real-time notification of approval status | No notification infrastructure yet; defer to future |
| Hard delete of any entity | Soft delete (is_active) is established pattern; audit integrity |
| Specific reference list in delete error | Generic error sufficient per user preference; defer detailed view |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SOAR-01 | Phase 27 | Pending |
| SOAR-02 | Phase 28 | Pending |
| SOAR-03 | Phase 28 | Pending |
| SOAR-04 | Phase 27 | Pending |
| SOAR-05 | Phase 28 | Pending |
| SOAR-06 | Phase 28 | Pending |
| SOAR-07 | Phase 28 | Pending |
| SOAR-08 | Phase 28 | Pending |
| SOAR-09 | Phase 27 | Pending |
| SOAR-10 | Phase 27 | Pending |
| SOAR-11 | Phase 27 | Pending |
| DPRT-01 | Phase 29 | Pending |
| DPRT-02 | Phase 29 | Pending |
| DPRT-03 | Phase 29 | Pending |
| DPRT-04 | Phase 29 | Pending |
| DPRT-05 | Phase 29 | Pending |
| DPRT-06 | Phase 29 | Pending |
| DPRT-07 | Phase 29 | Pending |
| UMGT-01 | Phase 30 | Pending |
| UMGT-02 | Phase 30 | Pending |
| UMGT-03 | Phase 30 | Pending |
| CSLR-01 | Phase 31 | Pending |
| CSLR-02 | Phase 31 | Pending |
| CSLR-03 | Phase 31 | Pending |
| CSLR-04 | Phase 31 | Pending |
| CSLR-05 | Phase 31 | Pending |

**Coverage:**
- v1.6 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

**Requirement Distribution by Phase:**
- Phase 27 (Stock-Out Approval DB Foundation): 5 requirements
- Phase 28 (Stock-Out Request & Approval UI): 7 requirements
- Phase 29 (Deletion Protection): 7 requirements
- Phase 30 (User Deactivation): 3 requirements
- Phase 31 (Context Sliders): 5 requirements

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 - Roadmap created, all requirements mapped*
