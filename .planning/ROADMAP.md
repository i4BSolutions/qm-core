# Roadmap: QM System

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-27)
- ✅ **v1.1 Enhancement** - Phases 5-10 (shipped 2026-01-28)
- ✅ **v1.2 Inventory & Financial Accuracy** - Phases 11-16 (shipped 2026-01-31)
- ✅ **v1.3 UX & Bug Fixes** - Phases 17-19 (shipped 2026-02-02)
- ✅ **v1.4 UX Enhancements & Workflow Improvements** - Phases 20-22 (shipped 2026-02-06)
- ✅ **v1.5 UX Polish & Collaboration** - Phases 23-26 (shipped 2026-02-09)
- ✅ **v1.6 Stock-Out Approval & Data Integrity** - Phases 27-31 (shipped 2026-02-10)
- ✅ **v1.7 Stock-Out Request Logic Repair** - Phases 32-35 (shipped 2026-02-11)
- ✅ **v1.8 UI Consistency, Flow Tracking & RBAC** - Phases 36-40 (shipped 2026-02-12)
- ✅ **v1.9 PO Lifecycle, Cancellation Guards & PDF Export** - Phases 41-43 (shipped 2026-02-13)
- ✅ **v1.10 Tech Debt Cleanup** - Phases 44-46 (shipped 2026-02-14)
- ✅ **v1.11 Standard Unit System** - Phases 47-54 (shipped 2026-02-16)
- ✅ **v1.12 List Views & Approval Workflow** - Phases 55-58 (shipped 2026-02-20)
- 🚧 **v1.13 Permission Matrix & Auto Status** - Phases 59-64 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-27</summary>

Phases 1-4 delivered foundational authentication, QMRL/QMHQ modules, purchase orders, invoices, and inventory management with audit logging.

</details>

<details>
<summary>✅ v1.1 Enhancement (Phases 5-10) - SHIPPED 2026-01-28</summary>

Phases 5-10 delivered file attachments, management dashboard, quick status changes, and date picker standardization.

</details>

<details>
<summary>✅ v1.2 Inventory & Financial Accuracy (Phases 11-16) - SHIPPED 2026-01-31</summary>

Phases 11-16 delivered warehouse detail with WAC display, inventory dashboard, manual stock-in, and invoice void cascade.

</details>

<details>
<summary>✅ v1.3 UX & Bug Fixes (Phases 17-19) - SHIPPED 2026-02-02</summary>

Phases 17-19 delivered attachment delete fixes, fulfillment progress tracking, number input behavior fixes, and standardized currency display.

</details>

<details>
<summary>✅ v1.4 UX Enhancements & Workflow Improvements (Phases 20-22) - SHIPPED 2026-02-06</summary>

Phases 20-22 delivered file upload in QMRL form, QMRL context panel, thousand separators, responsive amounts, item price reference, auto-generated SKU codes, inline item creation, multi-tab auth handling, and mandatory contact person validation.

</details>

<details>
<summary>✅ v1.5 UX Polish & Collaboration (Phases 23-26) - SHIPPED 2026-02-09</summary>

Phases 23-26 delivered threaded comments on all detail pages, fluid font scaling with K/M/B abbreviation, two-step category-first item selectors, and unified QMHQ currency inheritance with dual Org/EUSD display.

</details>

<details>
<summary>✅ v1.6 Stock-Out Approval & Data Integrity (Phases 27-31) - SHIPPED 2026-02-10</summary>

Phases 27-31 delivered stock-out request/approval workflow with partial approval and atomic execution, deletion protection for 6 entity types, user deactivation with login blocking, and context sliders for QMHQ and stock-out pages.

</details>

<details>
<summary>✅ v1.7 Stock-Out Request Logic Repair (Phases 32-35) - SHIPPED 2026-02-11</summary>

Phases 32-35 delivered per-line-item stock-out execution, QMHQ transaction linking with SOR-grouped display, dual reference display (SOR + QMHQ), database trigger hardening with advisory locks, and aggregate fulfillment metrics.

</details>

<details>
<summary>✅ v1.8 UI Consistency, Flow Tracking & RBAC (Phases 36-40) - SHIPPED 2026-02-12</summary>

Phases 36-40 delivered 7 composite UI components with 32-page migration, RBAC overhaul from 7 to 3 roles with 92 RLS policies, and admin-only end-to-end flow tracking page.

</details>

<details>
<summary>✅ v1.9 PO Lifecycle, Cancellation Guards & PDF Export (Phases 41-43) - SHIPPED 2026-02-13</summary>

Phases 41-43 delivered PO smart status engine with 6-state auto-calculation, cancellation/void guards at DB and UI levels, admin-only closed PO unlock, PO Matching tab, per-line-item progress bars, and professional dark-themed PDF receipt export for invoices, stock-out requests, and money-out transactions.

</details>

<details>
<summary>✅ v1.10 Tech Debt Cleanup (Phases 44-46) - SHIPPED 2026-02-14</summary>

Phases 44-46 delivered PO header editing with status guards and audit logging, flow tracking VIEW performance optimization with 8 partial indexes and OR join elimination, and JSDoc-annotated composite component prop interfaces.

</details>

<details>
<summary>✅ v1.11 Standard Unit System (Phases 47-54) - SHIPPED 2026-02-16</summary>

Phases 47-54 delivered per-item standard unit management with admin CRUD, per-transaction conversion rate input on all quantity forms, standard quantity display on every detail page and PDF export, and USD exchange rate auto-lock enforcement at database and UI levels.

</details>

<details>
<summary>✅ v1.12 List Views & Approval Workflow (Phases 55-58) - SHIPPED 2026-02-20</summary>

Phases 55-58 delivered standardized list views with consistent columns and pagination across 6 entity pages, two-layer stock-out approval with warehouse assignment, dedicated execution page, and auto-generated user avatars in list views, comments, and audit history.

</details>

### 🚧 v1.13 Permission Matrix & Auto Status (In Progress)

**Milestone Goal:** Replace fixed 3-role RBAC with a per-user permission matrix across 15 resources, add computed QMHQ auto status by route type, and redesign the dashboard as a permission-filtered QMRL list with auto status column.

- [ ] **Phase 59: Permission Schema & Migration** - New permission table, 15-resource enum, and migration of existing users from 3-role model
- [ ] **Phase 60: RLS Policy Rewrite** - Replace all 100 role-based RLS policies with permission-matrix enforcement across all 22 tables
- [ ] **Phase 61: Permission Management UI** - Admin can view, assign, and edit per-user permissions with lockout prevention
- [ ] **Phase 62: Frontend Permission Enforcement** - Sidebar hiding, page redirects, button gating, and server-action rejection
- [ ] **Phase 63: QMHQ Auto Status** - Computed route-based status (Item/Expense/PO × Pending/Processing/Done) derived from child records
- [ ] **Phase 64: Dashboard Redesign** - QMRL list with auto status column, old KPI sections removed, permission-gated access

---

#### Phase 59: Permission Schema & Migration
**Goal**: The permission model is stored in the database — each user has Edit, View, or Block per resource, existing users are migrated, and the old role enum is superseded.
**Depends on**: Phase 58 (v1.12 shipped — existing user table with role column)
**Requirements**: PERM-01, PERM-10
**Success Criteria** (what must be TRUE):
  1. A `user_permissions` table (or equivalent) exists with one row per user per resource (15 resources × N users)
  2. Every existing user has a complete set of 15 permissions migrated from their old role (admin gets Edit on all, qmrl/qmhq get scoped permissions)
  3. A new user creation path requires all 15 permissions to be explicitly set before the user row is saved
  4. The 15 resource identifiers are codified as an enum or constraint (no free-text resource names)
**Plans**: TBD

Plans:
- [ ] 59-01: Permission schema migration and data backfill

---

#### Phase 60: RLS Policy Rewrite
**Goal**: Every database operation is authorized against the permission matrix — old role-based policies are gone, Edit grants full CRUD, View grants read-only, Block denies all.
**Depends on**: Phase 59 (permission table exists with data)
**Requirements**: PERM-09
**Success Criteria** (what must be TRUE):
  1. All 100 existing RLS policies across 22 tables are replaced with permission-matrix-aware policies
  2. A user with Edit permission on a resource can insert, update, and select records for that resource
  3. A user with View permission on a resource can only select — insert and update return permission denied
  4. A user with Block permission on a resource receives no rows on select and permission denied on mutations
  5. Admin users retain full access to all resources regardless of permission rows
**Plans**: TBD

Plans:
- [ ] 60-01: RLS policy rewrite for all 22 tables

---

#### Phase 61: Permission Management UI
**Goal**: Admins can manage any user's permissions through a matrix UI — all 15 resources visible at once, changes saved atomically, and no admin can remove their own Admin resource Edit permission.
**Depends on**: Phase 59 (permission data exists to display and edit)
**Requirements**: PERM-02, PERM-03, PERM-04, PERM-11
**Success Criteria** (what must be TRUE):
  1. Admin can open a permissions screen for any user and see all 15 resources with their current Edit/View/Block assignment
  2. Admin can change any permission and save — the matrix updates atomically (all 15 saved or none)
  3. The user creation form includes a mandatory permission matrix step that must be completed before the user is created
  4. When an admin tries to set their own Admin resource permission to View or Block, the change is rejected with a clear error
**Plans**: TBD

Plans:
- [ ] 61-01: Permission management UI and user creation flow

---

#### Phase 62: Frontend Permission Enforcement
**Goal**: The application surface area reflects each user's permissions without manual role checks — sidebar hides blocked resources, pages redirect on block, write actions are invisible to view-only users, and server actions reject unauthorized mutations.
**Depends on**: Phase 60 (RLS enforces at DB), Phase 61 (permissions are manageable)
**Requirements**: PERM-05, PERM-06, PERM-07, PERM-08
**Success Criteria** (what must be TRUE):
  1. Sidebar navigation items for resources where the user has Block permission are not rendered — they cannot navigate to blocked resources from the sidebar
  2. Navigating directly to a blocked resource URL redirects the user away (to dashboard or an access-denied page)
  3. Create, edit, and delete action buttons are not rendered when a user has View-only permission on that resource
  4. Server actions (form submissions, mutations) for a resource return an error when the caller has View or Block permission, even if the request is crafted manually
**Plans**: TBD

Plans:
- [ ] 62-01: Sidebar filtering and page-level redirect guards
- [ ] 62-02: Button-level gating and server-action rejection

---

#### Phase 63: QMHQ Auto Status
**Goal**: Every QMHQ record exposes a computed status derived from its route type and child record state — Item route reflects SOR progress, Expense route reflects money-in and yet-to-receive, PO route reflects PO existence and financial closure.
**Depends on**: Phase 58 (QMHQ and its child tables exist in v1.12 state)
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07, AUTO-08, AUTO-09
**Success Criteria** (what must be TRUE):
  1. An Item route QMHQ with no SOR approvals or rejections displays "Item Pending"
  2. An Item route QMHQ with at least one SOR L1 or L2 approval displays "Item Processing"
  3. An Item route QMHQ where all SOR line items are executed displays "Item Done"
  4. Expense route QMHQ transitions correctly through "Expense Pending" (no money-in), "Expense Processing" (any money-in), and "Expense Done" (yet-to-receive <= 0)
  5. PO route QMHQ transitions correctly through "PO Pending" (no non-cancelled PO), "PO Processing" (any non-cancelled PO exists), and "PO Done" (yet-to-receive <= 0 AND balance-in-hand <= 0)
**Plans**: TBD

Plans:
- [ ] 63-01: Auto status computation logic (VIEW or trigger) and API exposure

---

#### Phase 64: Dashboard Redesign
**Goal**: The dashboard is a QMRL list with an auto status column, old KPI sections are removed, and access requires at least View on System Dashboard.
**Depends on**: Phase 62 (permission enforcement for DASH-04), Phase 63 (auto status for DASH-02)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. The dashboard page shows a paginated list of all QMRLs — same data as the QMRL list page
  2. Each QMRL row in the dashboard includes a QMHQ auto status column showing the computed route status (Item Pending/Processing/Done, Expense Pending/Processing/Done, PO Pending/Processing/Done, or blank if no QMHQ)
  3. The old dashboard sections (KPI cards, Low Stock Alerts, Recent Activity, Stock Movements) are gone — no remnants in the DOM or code
  4. A user with Block permission on System Dashboard is redirected away from the dashboard URL and sees no dashboard nav item
**Plans**: TBD

Plans:
- [ ] 64-01: Dashboard QMRL list with auto status column and access guard

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation -> Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs -> UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC -> Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach -> Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload -> Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23-26. Comments -> Currency | v1.5 | 9/9 | ✓ Complete | 2026-02-09 |
| 27-31. Stock-Out -> Sliders | v1.6 | 12/12 | ✓ Complete | 2026-02-10 |
| 32-35. Linking -> Execution UI | v1.7 | 7/7 | ✓ Complete | 2026-02-11 |
| 36-40. UI Composites -> RBAC -> Flow Tracking | v1.8 | 15/15 | ✓ Complete | 2026-02-12 |
| 41-43. PO Status -> Guards -> PDF | v1.9 | 8/8 | ✓ Complete | 2026-02-13 |
| 44-46. PO Edit -> Flow Perf -> Type Safety | v1.10 | 3/3 | ✓ Complete | 2026-02-14 |
| 47-54. Standard Units -> USD Lock | v1.11 | 17/17 | ✓ Complete | 2026-02-16 |
| 55-58. List Views -> Avatars | v1.12 | 9/9 | ✓ Complete | 2026-02-20 |
| 59. Permission Schema & Migration | v1.13 | 0/TBD | Not started | - |
| 60. RLS Policy Rewrite | v1.13 | 0/TBD | Not started | - |
| 61. Permission Management UI | v1.13 | 0/TBD | Not started | - |
| 62. Frontend Permission Enforcement | v1.13 | 0/TBD | Not started | - |
| 63. QMHQ Auto Status | v1.13 | 0/TBD | Not started | - |
| 64. Dashboard Redesign | v1.13 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-20 after v1.13 roadmap created*
