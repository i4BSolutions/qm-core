# Requirements: QM System

**Defined:** 2026-02-11
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.8 Requirements

Requirements for v1.8 milestone. Each maps to roadmap phases.

### UI Standardization

- [x] **UI-01**: User sees consistent page headers (title, description, action buttons) across all list pages
- [x] **UI-02**: User sees consistent filter bars (search, dropdowns, date pickers) with standardized layout on all list pages
- [x] **UI-03**: User sees consistent data table layout with uniform column sizing, sorting, and pagination across all tables
- [x] **UI-04**: User sees consistent button sizing, variant hierarchy (primary/secondary/ghost), and placement across all pages
- [x] **UI-05**: User sees consistent form input sizing, label placement, and error message display across all forms
- [x] **UI-06**: User sees consistent detail page layout (header with actions, tabs, content area) across all detail pages
- [x] **UI-07**: User sees consistent card view layout with standardized info density across all card views
- [x] **UI-08**: User sees consistent spacing, padding, and margins following a standardized scale across all pages

### RBAC

- [x] **RBAC-01**: Database role system migrated from 7 roles to 3 roles (admin, qmrl, qmhq)
- [x] **RBAC-02**: Existing users are remapped to appropriate new roles via data migration
- [x] **RBAC-03**: All RLS policies enforce the 3-role permission model
- [x] **RBAC-04**: Navigation sidebar shows only sections permitted by the user's role
- [x] **RBAC-05**: QMRL role user can create new QMRLs
- [x] **RBAC-06**: QMRL role user can view all QMRLs in the system
- [x] **RBAC-07**: QMRL role user cannot access QMHQ, PO, Invoice, or Inventory pages
- [x] **RBAC-08**: QMHQ role user can create new QMHQs
- [x] **RBAC-09**: QMHQ role user can view all QMRLs (read-only)
- [x] **RBAC-10**: QMHQ role user can view all QMHQs and their details
- [x] **RBAC-11**: QMHQ role user can view financial transactions on QMHQs
- [x] **RBAC-12**: QMHQ role user can view stock levels per item and warehouse (summary only, no individual transaction history)
- [x] **RBAC-13**: QMHQ role user can view purchase orders and their details
- [x] **RBAC-14**: Admin retains full CRUD access to all entities and pages
- [x] **RBAC-15**: Stock-out approvals remain restricted to Admin role only
- [x] **RBAC-16**: Role permission system supports adding new roles in the future without schema redesign

### Flow Tracking

- [x] **FLOW-01**: Admin can access a dedicated end-to-end flow tracking page from navigation
- [x] **FLOW-02**: Admin can search by QMRL ID to view its complete downstream chain
- [x] **FLOW-03**: Tracking page displays the QMRL with its current status and key details
- [x] **FLOW-04**: Tracking page displays all linked QMHQs with their route types and statuses
- [x] **FLOW-05**: For Item route QMHQs, tracking shows stock-out requests and execution status
- [x] **FLOW-06**: For Expense route QMHQs, tracking shows financial transactions
- [x] **FLOW-07**: For PO route QMHQs, tracking shows linked POs, invoices, and stock-in status
- [x] **FLOW-08**: Only Admin role can access the flow tracking page

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### RBAC Extensions

- **RBAC-F01**: Additional roles beyond Admin/QMRL/QMHQ (user will define)
- **RBAC-F02**: Role-specific dashboard views
- **RBAC-F03**: Approval delegation to non-admin roles

### Flow Tracking Extensions

- **FLOW-F01**: Browse/list all QMRLs with status indicators before drilling in
- **FLOW-F02**: Search by QMHQ/PO/Invoice ID (not just QMRL)
- **FLOW-F03**: Flow tracking accessible to non-admin roles with scoped visibility

## Out of Scope

| Feature | Reason |
|---------|--------|
| React Flow or graph visualization library | Linear chain doesn't need graph — card-based layout sufficient |
| Real-time flow updates via WebSocket | Polling/query refresh sufficient for admin tracking tool |
| Custom role creation UI | Roles managed via migration; no self-service role management needed yet |
| Approval delegation to QMHQ role | User confirmed Admin-only approvals for now |
| Materialized views for flow tracking | Assumes <10K QMRLs; regular VIEW sufficient for MVP |
| Component library documentation site | Internal tool — CLAUDE.md conventions sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 36, 40 | ✓ Done |
| UI-02 | Phase 36, 40 | ✓ Done |
| UI-03 | Phase 36, 40 | ✓ Done |
| UI-04 | Phase 36, 40 | ✓ Done |
| UI-05 | Phase 36, 40 | ✓ Done |
| UI-06 | Phase 36, 40 | ✓ Done |
| UI-07 | Phase 36, 40 | ✓ Done |
| UI-08 | Phase 36, 40 | ✓ Done |
| RBAC-01 | Phase 37 | ✓ Done |
| RBAC-02 | Phase 37 | ✓ Done |
| RBAC-03 | Phase 38 | ✓ Done |
| RBAC-04 | Phase 38 | ✓ Done |
| RBAC-05 | Phase 38 | ✓ Done |
| RBAC-06 | Phase 38 | ✓ Done |
| RBAC-07 | Phase 38 | ✓ Done |
| RBAC-08 | Phase 38 | ✓ Done |
| RBAC-09 | Phase 38 | ✓ Done |
| RBAC-10 | Phase 38 | ✓ Done |
| RBAC-11 | Phase 38 | ✓ Done |
| RBAC-12 | Phase 38 | ✓ Done |
| RBAC-13 | Phase 38 | ✓ Done |
| RBAC-14 | Phase 38 | ✓ Done |
| RBAC-15 | Phase 38 | ✓ Done |
| RBAC-16 | Phase 37 | ✓ Done |
| FLOW-01 | Phase 39 | ✓ Done |
| FLOW-02 | Phase 39 | ✓ Done |
| FLOW-03 | Phase 39 | ✓ Done |
| FLOW-04 | Phase 39 | ✓ Done |
| FLOW-05 | Phase 39 | ✓ Done |
| FLOW-06 | Phase 39 | ✓ Done |
| FLOW-07 | Phase 39 | ✓ Done |
| FLOW-08 | Phase 39 | ✓ Done |

**Coverage:**
- v1.8 requirements: 32 total — **32/32 satisfied (100%)**
- UI requirements: 8/8 ✓ (Phases 36, 40)
- RBAC requirements: 16/16 ✓ (Phases 37, 38)
- Flow Tracking requirements: 8/8 ✓ (Phase 39)

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-12 after v1.8 milestone audit passed*
