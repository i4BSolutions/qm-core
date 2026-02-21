# Requirements: QM System

**Defined:** 2026-02-20
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.13 Requirements

Requirements for v1.13 Permission Matrix & Auto Status. Each maps to roadmap phases.

### Permission Matrix

- [ ] **PERM-01**: Admin can assign Edit, View, or Block permission per resource per user (15 resources: System Dashboard, QMRL, QMHQ, Money Transactions, Inv Transactions, PO, Invoice, Stock In, SOR-L1, SOR-L2, SOR-L3, Warehouse, Inventory Dashboard, Item, Admin)
- [x] **PERM-02**: Admin can manage any user's permissions through a permission matrix UI
- [x] **PERM-03**: All 15 permissions must be set when creating a new user account
- [x] **PERM-04**: Admin can edit an existing user's permissions
- [x] **PERM-05**: Sidebar navigation hides resources where user has Block permission
- [x] **PERM-06**: Pages redirect when user has Block permission on that resource
- [x] **PERM-07**: Create/edit/delete buttons hidden when user has View-only permission
- [x] **PERM-08**: Server actions reject mutations when user has View or Block permission
- [x] **PERM-09**: All RLS policies rewritten to enforce permission matrix (Edit=CRUD, View=read, Block=none)
- [ ] **PERM-10**: Existing users migrated from 3-role system to permission matrix
- [x] **PERM-11**: User with Edit on Admin cannot remove their own Admin Edit permission (lockout prevention)

### Auto Status

- [ ] **AUTO-01**: Item route QMHQ shows "Item Pending" when no SOR L1 approval/rejection exists
- [ ] **AUTO-02**: Item route QMHQ shows "Item Processing" when any SOR L1 or L2 approval exists
- [ ] **AUTO-03**: Item route QMHQ shows "Item Done" when all SOR line items are executed
- [ ] **AUTO-04**: Expense route QMHQ shows "Expense Pending" when no money-in transaction exists
- [ ] **AUTO-05**: Expense route QMHQ shows "Expense Processing" when any money-in transaction exists
- [ ] **AUTO-06**: Expense route QMHQ shows "Expense Done" when Yet to Receive <= 0
- [ ] **AUTO-07**: PO route QMHQ shows "PO Pending" when no non-cancelled PO exists for this QMHQ
- [ ] **AUTO-08**: PO route QMHQ shows "PO Processing" when any non-cancelled PO exists
- [ ] **AUTO-09**: PO route QMHQ shows "PO Done" when Yet to Receive <= 0 AND Balance in Hand <= 0

### Dashboard

- [ ] **DASH-01**: Dashboard displays QMRL list view showing all QMRLs
- [ ] **DASH-02**: QMRL list includes QMHQ auto status column showing the computed route status
- [ ] **DASH-03**: Current dashboard sections removed (KPIs, Low Stock Alerts, Recent Activity, Stock Movements)
- [ ] **DASH-04**: Dashboard visibility requires View or Edit on System Dashboard permission

## Future Requirements

### Permission Enhancements

- **PERM-F01**: Bulk permission assignment (apply same permissions to multiple users)
- **PERM-F02**: Permission templates/presets for quick user setup
- **PERM-F03**: Permission change audit log with before/after comparison

## Out of Scope

| Feature | Reason |
|---------|--------|
| Role templates/groups | Per-user permission matrix only; no grouping mechanism |
| Permission inheritance | Each resource independent; Edit on PO doesn't imply View on Invoice |
| Permission-based notifications | No notification infrastructure exists |
| Auto status on QMHQ detail page | Dashboard column only for v1.13; can extend later |
| Configurable auto status thresholds | Fixed rules per route type |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERM-01 | Phase 59 | Pending |
| PERM-02 | Phase 61 | Complete |
| PERM-03 | Phase 61 | Complete |
| PERM-04 | Phase 61 | Complete |
| PERM-05 | Phase 62 | Complete |
| PERM-06 | Phase 62 | Complete |
| PERM-07 | Phase 62 | Complete |
| PERM-08 | Phase 62 | Complete |
| PERM-09 | Phase 60 | Complete |
| PERM-10 | Phase 59 | Pending |
| PERM-11 | Phase 61 | Complete |
| AUTO-01 | Phase 63 | Pending |
| AUTO-02 | Phase 63 | Pending |
| AUTO-03 | Phase 63 | Pending |
| AUTO-04 | Phase 63 | Pending |
| AUTO-05 | Phase 63 | Pending |
| AUTO-06 | Phase 63 | Pending |
| AUTO-07 | Phase 63 | Pending |
| AUTO-08 | Phase 63 | Pending |
| AUTO-09 | Phase 63 | Pending |
| DASH-01 | Phase 64 | Pending |
| DASH-02 | Phase 64 | Pending |
| DASH-03 | Phase 64 | Pending |
| DASH-04 | Phase 64 | Pending |

**Coverage:**
- v1.13 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after v1.13 roadmap created*
