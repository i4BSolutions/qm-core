# Requirements: QM System V1.1

**Defined:** 2025-01-27
**Core Value:** Users can reliably create purchase orders and receive inventory, with full visibility into request status and attached documentation.

## v1.1 Requirements

Requirements for this release. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: Fix PO creation workflow — users cannot create purchase orders
- [ ] **BUG-02**: Fix stock-in functionality — users cannot receive inventory
- [ ] **BUG-03**: Verify invoice creation works correctly
- [ ] **BUG-04**: Verify stock-out functionality works correctly

### File Attachments

- [ ] **FILE-01**: User can drag-drop files to upload on QMRL create form
- [ ] **FILE-02**: User can drag-drop files to upload on QMRL detail page
- [ ] **FILE-03**: User can drag-drop files to upload on QMHQ create form
- [ ] **FILE-04**: User can drag-drop files to upload on QMHQ detail page
- [ ] **FILE-05**: System validates file type (PDF, Word, Excel, PNG, JPG, GIF)
- [ ] **FILE-06**: System validates file size (max 25MB per file)
- [ ] **FILE-07**: System enforces max 10 files per entity
- [ ] **FILE-08**: User can view list of uploaded files sorted by upload date
- [ ] **FILE-09**: User can preview images inline
- [ ] **FILE-10**: User can preview PDFs in-app
- [ ] **FILE-11**: User can see thumbnail previews in file list
- [ ] **FILE-12**: User can delete files (if has edit access to parent entity)
- [ ] **FILE-13**: User can download all files as ZIP

### Dashboard

- [ ] **DASH-01**: Admin/Quartermaster sees live dashboard on /dashboard
- [ ] **DASH-02**: Other roles redirected to their primary page from /dashboard
- [ ] **DASH-03**: Dashboard shows QMRL counts by status group (to_do, in_progress, done)
- [ ] **DASH-04**: Dashboard shows QMHQ counts by status group
- [ ] **DASH-05**: Dashboard shows low stock alerts (items below 10 units)
- [ ] **DASH-06**: Dashboard shows recent activity feed (5 most recent actions)
- [ ] **DASH-07**: Dashboard shows recent stock movements

### UX Improvements

- [ ] **UX-01**: User can click status badge on QMRL detail to change status via dropdown
- [ ] **UX-02**: User can click status badge on QMHQ detail to change status via dropdown
- [ ] **UX-03**: Quick status changes are logged in audit history
- [ ] **UX-04**: User can click transaction row to open detail modal
- [ ] **UX-05**: Transaction modal shows full transaction details
- [ ] **UX-06**: User can edit transaction date in modal
- [ ] **UX-07**: User can edit transaction notes in modal
- [ ] **UX-08**: Transaction amount/exchange rate are read-only (audit integrity)
- [ ] **UX-09**: Money in/out date picker matches QMRL/QMHQ/PO date picker design

### Invoice Behavior

- [ ] **INV-01**: Invoice line item quantity cannot exceed PO line item quantity
- [ ] **INV-02**: Invoice total amount CAN exceed PO total amount (price flexibility)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### File Enhancements

- **FILE-V2-01**: Virus scanning on upload
- **FILE-V2-02**: Version history for replaced files
- **FILE-V2-03**: File attachments on PO and Invoice entities

### Dashboard Enhancements

- **DASH-V2-01**: Real-time WebSocket updates
- **DASH-V2-02**: Trend indicators (up/down vs yesterday)
- **DASH-V2-03**: Click-through to filtered entity lists
- **DASH-V2-04**: Customizable dashboard widgets

### Inventory Enhancements

- **INV-V2-01**: Per-item low stock thresholds
- **INV-V2-02**: Storage quota monitoring alerts

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time dashboard updates | Polling sufficient for low-frequency updates, adds complexity |
| Per-item stock thresholds | Global default (10 units) sufficient for V1.1 |
| Transaction amount editing | Locked for audit integrity by design |
| Bulk status updates | Single status change sufficient for V1.1 |
| File attachments on PO/Invoice | QMRL/QMHQ scope first, extend in V2 |
| Mobile-specific file upload | Desktop web first, responsive design handles mobile |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | TBD | Pending |
| BUG-02 | TBD | Pending |
| BUG-03 | TBD | Pending |
| BUG-04 | TBD | Pending |
| FILE-01 | TBD | Pending |
| FILE-02 | TBD | Pending |
| FILE-03 | TBD | Pending |
| FILE-04 | TBD | Pending |
| FILE-05 | TBD | Pending |
| FILE-06 | TBD | Pending |
| FILE-07 | TBD | Pending |
| FILE-08 | TBD | Pending |
| FILE-09 | TBD | Pending |
| FILE-10 | TBD | Pending |
| FILE-11 | TBD | Pending |
| FILE-12 | TBD | Pending |
| FILE-13 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| DASH-05 | TBD | Pending |
| DASH-06 | TBD | Pending |
| DASH-07 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| UX-05 | TBD | Pending |
| UX-06 | TBD | Pending |
| UX-07 | TBD | Pending |
| UX-08 | TBD | Pending |
| UX-09 | TBD | Pending |
| INV-01 | TBD | Pending |
| INV-02 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 32 total
- Mapped to phases: 0
- Unmapped: 32 (roadmap pending)

---
*Requirements defined: 2025-01-27*
*Last updated: 2025-01-27 after initial definition*
