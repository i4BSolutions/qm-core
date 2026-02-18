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
- 🚧 **v1.12 List Views & Approval Workflow** - Phases 55-58 (in progress)

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

### 🚧 v1.12 List Views & Approval Workflow (In Progress)

**Milestone Goal:** Standardize all list views with consistent columns and pagination, add two-layer stock-out approval with warehouse assignment, a dedicated stock-out execution page, and auto-generated user avatars throughout the UI.

- [x] **Phase 55: Database Foundation + UserAvatar** - Two-layer approval migration with backfill, boring-avatars install, UserAvatar component (completed 2026-02-17)
- [x] **Phase 56: List View Standardization** - QMRL list view, standardized columns on all 6 list pages, pagination, assigned person filter (completed 2026-02-17)
- [x] **Phase 57: Two-Layer Approval UI + Execution Page** - Layer 1/2 approval dialogs, status machine UI, dedicated stock-out execution page (completed 2026-02-17)
- [ ] **Phase 58: History Avatars + Comment Avatars** - UserAvatar in audit history entries, UserAvatar in comment cards, system action indicator

## Phase Details

### Phase 55: Database Foundation + UserAvatar
**Goal**: The two-layer approval schema is in the database and a shared UserAvatar component is available for all downstream consumers.
**Depends on**: Nothing (first phase of v1.12)
**Requirements**: APPR-06, AVTR-01, AVTR-04
**Success Criteria** (what must be TRUE):
  1. Migration 063 is applied: `stock_out_approvals` has `layer` and `parent_approval_id` columns, and `sor_line_item_status` enum includes `awaiting_admin`
  2. All existing `stock_out_approvals` records with `decision = 'approved'` have `layer = 'admin'` set (backfill complete, no NULL layer on approved records)
  3. `boring-avatars` package is installed and importable in the project
  4. `UserAvatar` component exists at `/components/ui/user-avatar.tsx`, accepts a `fullName` string, and renders the same deterministic SVG avatar for the same name on every page
**Plans:** 2/2 plans complete

Plans:
- [x] 55-01-PLAN.md -- Two-layer approval database migration with enum extension, trigger rewrites, and data backfill
- [x] 55-02-PLAN.md -- boring-avatars install and UserAvatar component

### Phase 56: List View Standardization
**Goal**: Every major list page has a consistent list view with defined columns, working pagination, and an assigned person filter.
**Depends on**: Phase 55 (UserAvatar needed for assigned person column chips)
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, AVTR-03, PAGE-01, PAGE-02, PAGE-03
**Success Criteria** (what must be TRUE):
  1. QMRL page has a card/list toggle; the list view shows ID, Title, Status, Assigned Person, and Request Date columns
  2. QMHQ, PO, Invoice, Items, and Stock-out list views each show their specified columns (ID/Name, Route/Supplier/SKU, Status, Amount/Unit, relevant reference)
  3. Every list and card page uses the same Pagination component; navigating to any list page and switching pages works consistently
  4. Every list and card page has an assigned person filter; selecting a person narrows the results
  5. Changing any filter (including assigned person) resets the page display to page 1
  6. User avatar chips appear next to assigned person names in all list view rows
**Plans:** 3/3 plans complete

Plans:
- [x] 56-01-PLAN.md -- Shared usePaginationParams hook + QMRL list view with card/list toggle, URL pagination, responsive behavior
- [x] 56-02-PLAN.md -- QMHQ, PO, Invoice, Items standardization: assigned filter, avatar columns, toolbar toggle, URL pagination
- [x] 56-03-PLAN.md -- Stock-out requests standardization + cross-page verification

### Phase 57: Two-Layer Approval UI + Execution Page
**Goal**: Admins can approve stock-out quantities in Layer 1 and assign a warehouse in Layer 2; execution is blocked until both layers are complete; a dedicated execution page replaces the old stock-out sidebar link.
**Depends on**: Phase 55 (requires `layer` column and `awaiting_admin` enum value)
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04, APPR-05, EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. Admin can approve a stock-out line item quantity without selecting a warehouse (Layer 1); after approval the line item shows "Awaiting Admin Approval" status
  2. Admin can then select a warehouse and approve the assigned quantity as a second step (Layer 2); the Layer 2 quantity cannot exceed the Layer 1 approved quantity
  3. Submitting a Layer 2 warehouse approval with a quantity exceeding available warehouse stock is blocked with a hard error (not just a warning)
  4. The Execute button on a line item is disabled until both Layer 1 and Layer 2 approvals are in the `approved` state
  5. A dedicated stock-out execution page at `/inventory/stock-out` shows approved items ready for execution in list view, with a warehouse filter
  6. The sidebar navigation "Stock Out" link points to the new execution page; no new request button on execution page
**Plans:** 3/3 plans complete

Plans:
- [x] 57-01-PLAN.md -- L1 approval dialog, progress bar, per-row action buttons replacing batch selection
- [x] 57-02-PLAN.md -- L2 warehouse dialog with stock validation, Warehouse Assignments tab, expandable line item sections
- [x] 57-03-PLAN.md -- Dedicated execution page with warehouse/status filters, sidebar navigation update

### Phase 58: History Avatars + Comment Avatars
**Goal**: Every place a user's name appears in audit history or comment cards shows their auto-generated avatar alongside the name.
**Depends on**: Phase 55 (UserAvatar component)
**Requirements**: HIST-01, HIST-02, AVTR-02
**Success Criteria** (what must be TRUE):
  1. Each entry in every audit history tab shows the acting user's avatar circle next to their name
  2. System-generated history entries (no human actor) show a distinct "System" indicator instead of a user avatar
  3. Each comment card shows the commenter's avatar next to their name, consistent with the avatar shown in list view rows
**Plans:** 1 plan (AVTR-02 already satisfied in comment-card.tsx; consolidated to single plan)

Plans:
- [ ] 58-01-PLAN.md -- UserAvatar in history entries, system Bot indicator, AVTR-02 verification

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
| 55. DB Foundation + UserAvatar | v1.12 | 2/2 | ✓ Complete | 2026-02-17 |
| 56. List View Standardization | v1.12 | 3/3 | ✓ Complete | 2026-02-17 |
| 57. Two-Layer Approval + Execution | v1.12 | 3/3 | ✓ Complete | 2026-02-17 |
| 58. History + Comment Avatars | v1.12 | 0/1 | Not started | - |

---
*Last updated: 2026-02-18 after Phase 58 plans created*
