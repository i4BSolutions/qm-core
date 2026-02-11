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
- 🚧 **v1.8 UI Consistency, Flow Tracking & RBAC** - Phases 36-40 (in progress)

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

### 🚧 v1.8 UI Consistency, Flow Tracking & RBAC (In Progress)

**Milestone Goal:** Standardize UI/UX across all pages, add admin-only end-to-end request tracking, and overhaul RBAC to three roles (Admin, QMRL, QMHQ) with extensibility for future roles.

#### Phase 36: UI Component Standardization

**Goal:** Establish reusable UI patterns through composite components that can be adopted incrementally across the codebase.

**Depends on:** Nothing (first phase of v1.8)

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08

**Success Criteria** (what must be TRUE):
1. User sees consistent page headers with title, description, and action button placement on pilot pages
2. User sees consistent filter bars with standardized search, dropdown, and date picker layouts on pilot pages
3. User sees consistent data tables with uniform column sizing, sorting, and pagination on pilot pages
4. User sees consistent button hierarchy (primary/secondary/ghost) and sizing on pilot pages
5. User sees consistent form layouts with standardized input sizing, label placement, and error displays on pilot pages

**Plans:** 3 plans

Plans:
- [ ] 36-01-PLAN.md — Core composite components (PageHeader, FilterBar, ActionButtons, FormField, FormSection)
- [ ] 36-02-PLAN.md — Layout composite components (DetailPageLayout, CardViewGrid) + barrel export
- [ ] 36-03-PLAN.md — Migrate 3 pilot pages (QMRL list, PO list, Item detail) to composites

---

#### Phase 37: RBAC Database Migration

**Goal:** Safely migrate the database from 7-role enum to 3-role enum using expand-and-contract pattern without data loss.

**Depends on:** Phase 36

**Requirements:** RBAC-01, RBAC-02, RBAC-16

**Success Criteria** (what must be TRUE):
1. Database user_role enum contains exactly 3 values (admin, qmrl, qmhq)
2. All existing users are successfully remapped to appropriate new roles (admin/quartermaster → admin, finance/inventory/proposal → qmhq, frontline/requester → qmrl)
3. Zero users have invalid or null roles after migration
4. Role enum supports adding new roles in the future without schema redesign (no hardcoded checks beyond enum definition)

**Plans:** TBD

Plans:
- [ ] 37-01: TBD (planning not started)

---

#### Phase 38: RBAC Permission Enforcement

**Goal:** Update all RLS policies, navigation, and permission checks to enforce the 3-role model across the application.

**Depends on:** Phase 37

**Requirements:** RBAC-03, RBAC-04, RBAC-05, RBAC-06, RBAC-07, RBAC-08, RBAC-09, RBAC-10, RBAC-11, RBAC-12, RBAC-13, RBAC-14, RBAC-15

**Success Criteria** (what must be TRUE):
1. QMRL role user can create QMRLs, view all QMRLs, but cannot access QMHQ/PO/Invoice/Inventory pages
2. QMHQ role user can create QMHQs, view all QMRLs (read-only), view all QMHQs with financial transactions, view stock levels summary, and view PO details
3. Admin retains full CRUD access to all entities and pages
4. Navigation sidebar shows only sections permitted by the user's current role
5. Stock-out approvals remain restricted to Admin role only

**Plans:** TBD

Plans:
- [ ] 38-01: TBD (planning not started)

---

#### Phase 39: End-to-End Flow Tracking

**Goal:** Build admin-only flow tracking page that displays the complete downstream chain from QMRL through all linked entities.

**Depends on:** Phase 38

**Requirements:** FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-08

**Success Criteria** (what must be TRUE):
1. Admin can access a dedicated flow tracking page from navigation
2. Admin can search by QMRL ID to view the complete downstream chain (QMRL → QMHQs → POs → Invoices → Stock)
3. Tracking page displays QMRL with current status, all linked QMHQs with route types and statuses
4. For Item route QMHQs, tracking shows stock-out requests and execution status
5. For Expense route QMHQs, tracking shows financial transactions
6. For PO route QMHQs, tracking shows linked POs, invoices, and stock-in status
7. Only Admin role can access the flow tracking page (enforced by RLS and navigation)

**Plans:** TBD

Plans:
- [ ] 39-01: TBD (planning not started)

---

#### Phase 40: UI Consistency Rollout

**Goal:** Migrate remaining pages to standardized UI components incrementally, starting with simple pages and ending with complex forms.

**Depends on:** Phase 36

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08

**Success Criteria** (what must be TRUE):
1. At least 80% of list pages use standardized PageShell and FilterBar components
2. At least 80% of forms use standardized form input components
3. At least 80% of detail pages use standardized detail page layout
4. All card views use standardized card layout with consistent info density
5. All pages follow standardized spacing scale (consistent padding and margins)

**Plans:** TBD

Plans:
- [ ] 40-01: TBD (planning not started)

---

## Progress

**Execution Order:** 36 → 37 → 38 → 39 → 40

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation → Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs → UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC → Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach → Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload → Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23-26. Comments → Currency | v1.5 | 9/9 | ✓ Complete | 2026-02-09 |
| 27-31. Stock-Out → Sliders | v1.6 | 12/12 | ✓ Complete | 2026-02-10 |
| 32-35. Linking → Execution UI | v1.7 | 7/7 | ✓ Complete | 2026-02-11 |
| 36. UI Component Standardization | v1.8 | 0/3 | Planned | - |
| 37. RBAC Database Migration | v1.8 | 0/? | Not started | - |
| 38. RBAC Permission Enforcement | v1.8 | 0/? | Not started | - |
| 39. End-to-End Flow Tracking | v1.8 | 0/? | Not started | - |
| 40. UI Consistency Rollout | v1.8 | 0/? | Not started | - |

---
*Last updated: 2026-02-11 after v1.8 roadmap creation*
