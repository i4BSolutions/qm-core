# Requirements: QM System

**Defined:** 2026-02-17
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.12 Requirements

Requirements for v1.12 List Views & Approval Workflow milestone. Each maps to roadmap phases.

### Approval Workflow

- [ ] **APPR-01**: Admin can approve stock-out line item quantities without selecting a warehouse (Layer 1)
- [ ] **APPR-02**: Admin can assign a warehouse to a qty-approved line item as a second approval step (Layer 2)
- [ ] **APPR-03**: Layer 2 warehouse approval quantity cannot exceed Layer 1 approved quantity
- [ ] **APPR-04**: Layer 2 warehouse approval quantity cannot exceed available warehouse stock
- [ ] **APPR-05**: Stock-out execution is blocked until both Layer 1 and Layer 2 approvals are complete
- [ ] **APPR-06**: Existing approved stock-out records are migrated to work with the two-layer flow

### Stock-Out Execution Page

- [ ] **EXEC-01**: User can view approved stock-out items ready for execution in card view and list view
- [ ] **EXEC-02**: User can filter the stock-out execution page by warehouse
- [ ] **EXEC-03**: User can create a new stock-out request from the execution page
- [ ] **EXEC-04**: Stock-out sidebar navigation item links to the new execution page (replaces old stock-out link)

### List Views

- [ ] **LIST-01**: QMRL page has a list view with columns: ID, Title, Status, Assigned Person, Request Date
- [ ] **LIST-02**: QMHQ list view shows columns: ID, Name, Route, Status, Assigned Person, QMRL Ref
- [ ] **LIST-03**: PO list view shows columns: PO ID, Supplier, Status, Total Amount/EUSD, Progress, Date
- [ ] **LIST-04**: Invoice list view shows columns: INV ID, Status, Amount/EUSD, Received %, Date, PO Ref
- [ ] **LIST-05**: Items list view shows columns: SKU, Name, Category, Unit, Price Ref
- [ ] **LIST-06**: Stock-out execution page list view shows columns: SOR ID, Item, Requester, Reason, QMHQ Ref, Status

### User Avatars

- [ ] **AVTR-01**: User profile avatars are auto-generated using boring-avatars library when displayed
- [ ] **AVTR-02**: User avatar appears next to user name in comment cards
- [ ] **AVTR-03**: User avatar appears next to assigned person in list view rows
- [ ] **AVTR-04**: User avatar is consistent (same user always gets same avatar) across all pages

### Audit History

- [ ] **HIST-01**: Each audit history entry shows the user avatar next to the user name who performed the action
- [ ] **HIST-02**: System-generated actions (no user) show a distinct "System" indicator

### Pagination & Filters

- [ ] **PAGE-01**: All list and card view pages use the same Pagination component with consistent UI
- [ ] **PAGE-02**: All list pages can be filtered by assigned person
- [ ] **PAGE-03**: Page resets to page 1 when filters change

## Future Requirements

### Deferred

- **AVTR-05**: User can upload a custom profile photo
- **LIST-07**: Column sorting by clicking column headers in list view
- **LIST-08**: View mode preference persisted in localStorage
- **HIST-03**: Filter history entries by user
- **PAGE-04**: URL-synced pagination state for link sharing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Avatar photo upload flow | Requires storage bucket, upload UI, cropping — deterministic generation sufficient for internal tool |
| Server-side pagination | Client-side pagination with existing Pagination component sufficient for <500 records per entity |
| Configurable/hideable columns | Complex UI for low internal-tool value |
| Infinite scroll | Explicit pagination clearer with filters active |
| Real-time history auto-refresh | Internal tool, manual refresh sufficient |
| Multi-warehouse split per line item | One warehouse per approved line item — keeps flow simple |
| Different roles for Layer 1 vs Layer 2 approval | Both admin-only per user requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| APPR-01 | TBD | Pending |
| APPR-02 | TBD | Pending |
| APPR-03 | TBD | Pending |
| APPR-04 | TBD | Pending |
| APPR-05 | TBD | Pending |
| APPR-06 | TBD | Pending |
| EXEC-01 | TBD | Pending |
| EXEC-02 | TBD | Pending |
| EXEC-03 | TBD | Pending |
| EXEC-04 | TBD | Pending |
| LIST-01 | TBD | Pending |
| LIST-02 | TBD | Pending |
| LIST-03 | TBD | Pending |
| LIST-04 | TBD | Pending |
| LIST-05 | TBD | Pending |
| LIST-06 | TBD | Pending |
| AVTR-01 | TBD | Pending |
| AVTR-02 | TBD | Pending |
| AVTR-03 | TBD | Pending |
| AVTR-04 | TBD | Pending |
| HIST-01 | TBD | Pending |
| HIST-02 | TBD | Pending |
| PAGE-01 | TBD | Pending |
| PAGE-02 | TBD | Pending |
| PAGE-03 | TBD | Pending |

**Coverage:**
- v1.12 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after initial definition*
