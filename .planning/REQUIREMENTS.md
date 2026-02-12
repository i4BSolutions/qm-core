# Requirements: QM System v1.9

**Defined:** 2026-02-12
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1 Requirements

Requirements for v1.9 milestone. Each maps to roadmap phases.

### PO Status Engine

- [ ] **POSE-01**: PO status auto-calculates to one of 6 states (not_started, partially_invoiced, awaiting_delivery, partially_received, closed, cancelled) based on line-item matching
- [ ] **POSE-02**: Status recalculates automatically when invoice is created, voided, or stock-in is confirmed
- [ ] **POSE-03**: When partially invoiced AND partially received conflict, partially_invoiced takes priority
- [ ] **POSE-04**: PO status displays as color-coded badge on PO list and detail pages
- [ ] **POSE-05**: PO status is calculated (not user-editable) with tooltip explaining current state

### PO Progress Tracking

- [ ] **POPR-01**: User can see per-line-item progress bars showing ordered vs invoiced vs received quantities on PO detail page
- [ ] **POPR-02**: User can view Matching tab on PO detail page with side-by-side PO vs Invoice vs Stock-In comparison per line item
- [ ] **POPR-03**: Matching tab highlights discrepancies (under-invoiced, under-received) with visual indicators

### Lock Mechanism

- [ ] **LOCK-01**: When PO status is closed, all fields become read-only and edit actions are disabled
- [ ] **LOCK-02**: Admin user can unlock a closed PO for corrections
- [ ] **LOCK-03**: PO re-locks automatically when status returns to closed after changes
- [ ] **LOCK-04**: Closed POs are excluded from invoice creation PO selection dropdown

### Cancellation Guards

- [ ] **GARD-01**: User cannot cancel a PO that has any active (non-voided) invoices, with clear error message showing count
- [ ] **GARD-02**: User cannot void an invoice that has any stock-in transactions, with clear error message showing count
- [ ] **GARD-03**: Guard validation enforced at both UI level (disabled buttons with tooltips) and database level (triggers)
- [ ] **GARD-04**: When guard blocks an action, error message shows dependency chain explaining WHY it's blocked

### PDF Export

- [ ] **PDF-01**: User can download Invoice Receipt PDF from invoice detail page with invoice header, line items, totals, and EUSD equivalent
- [ ] **PDF-02**: User can download SOR-based Stock-Out Receipt PDF from stock-out transaction detail
- [ ] **PDF-03**: User can download QMHQ Money-Out Receipt PDF from QMHQ money-out transaction detail
- [ ] **PDF-04**: PDF styling matches app UI (colors, fonts, spacing) with professional print-friendly appearance
- [ ] **PDF-05**: PDFs include company branding (name, logo if available) and export timestamp in footer

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### PDF Export Enhancements

- **PDF-06**: GRN (Goods Received Note) PDF for stock-in transactions
- **PDF-07**: Email integration for sending PDFs directly from the app
- **PDF-08**: Multi-template PDF system with user-selectable templates

### PO Lifecycle Enhancements

- **POSE-06**: Real-time status updates via WebSocket/polling (currently requires page refresh)
- **POSE-07**: Status history timeline showing duration in each state for bottleneck analysis
- **POSE-08**: Partial PO cancellation (cancel specific line items)
- **POSE-09**: Reopen closed PO workflow (beyond admin unlock)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Partial PO cancellation | Complexity of tracking cancelled vs active line items per PO; close entire PO instead |
| Delete invoices | Financial regulations require audit trail; void only |
| Edit invoiced quantities | Breaks stock-in linkage; void and recreate instead |
| Stock-in before invoice | PRD specifies invoice-first flow; manual stock-in exists but doesn't affect PO status |
| PDF download + email in one action | Email requires SMTP config, recipient management; download only for v1 |
| Multi-template PDF system | Cognitive load from template selection; single consistent template matching app UI |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POSE-01 | — | Pending |
| POSE-02 | — | Pending |
| POSE-03 | — | Pending |
| POSE-04 | — | Pending |
| POSE-05 | — | Pending |
| POPR-01 | — | Pending |
| POPR-02 | — | Pending |
| POPR-03 | — | Pending |
| LOCK-01 | — | Pending |
| LOCK-02 | — | Pending |
| LOCK-03 | — | Pending |
| LOCK-04 | — | Pending |
| GARD-01 | — | Pending |
| GARD-02 | — | Pending |
| GARD-03 | — | Pending |
| GARD-04 | — | Pending |
| PDF-01 | — | Pending |
| PDF-02 | — | Pending |
| PDF-03 | — | Pending |
| PDF-04 | — | Pending |
| PDF-05 | — | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after initial definition*
