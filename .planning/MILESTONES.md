# Project Milestones: QM System

## v1.5 UX Polish & Collaboration (Shipped: 2026-02-09)

**Delivered:** Threaded comments on all detail pages, fluid font scaling with K/M/B abbreviation, two-step category-first item selectors, and unified QMHQ currency inheritance with dual Org/EUSD display.

**Phases completed:** 23-26 (9 plans total)

**Key accomplishments:**

- Added threaded comments on QMRL, QMHQ, PO, and Invoice detail pages with RLS-based visibility
- Built fluid font scaling (CSS clamp) and K/M/B abbreviation for large amounts on cards
- Created CategoryItemSelector for two-step category → item selection with search and AbortController
- Implemented QMHQ currency inheritance with locked fields, Inherited badge, and balance warning
- Added dual currency display (Org + EUSD) on QMHQ detail pages, list cards, and transaction lists

**Stats:**

- 71 files modified (+7,948/-273 lines)
- ~37,410 lines of TypeScript
- 4 phases, 9 plans, 25 requirements
- 2 days from start to ship

**Git range:** `054857c` → `38b13f1`

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---

## v1.4 UX Enhancements & Workflow Improvements (Shipped: 2026-02-06)

**Delivered:** File upload in QMRL create form, attachment delete fixes, QMRL context panel during QMHQ creation, thousand separators on amounts, item price reference with tooltip, auto-generated SKU codes, inline item creation in PO, multi-tab session handling, and contact person validation for financial routes.

**Phases completed:** 17-22 (9 plans total)

**Key accomplishments:**

- Fixed attachment delete with fetch-before-update pattern (RLS compatibility)
- Added staged file upload to QMRL create form with background processing
- Built QMRL context panel for QMHQ creation (responsive desktop/mobile)
- Created AmountInput/ExchangeRateInput components with thousand separators
- Added item price reference field with tooltip display in PO line item selector
- Implemented auto-generated SKU codes (SKU-[CAT]-[XXXX]) with random category codes
- Added inline item creation in PO line items table
- Built cross-tab session sync with BroadcastChannel and Safari fallback
- Added contact person validation for Expense and PO routes

**Stats:**

- 51 files modified (+9,619/-902 lines)
- ~34,000+ lines of TypeScript
- 6 phases, 9 plans
- 1 day from start to ship

**Git range:** `638ce66` → `1aa55d3`

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---

## v1.3 UX & Bug Fixes (Shipped: 2026-02-02)

**Delivered:** Consistent input behavior, standardized currency display, permission-gated edit buttons, and status change notes in audit history.

**Phases completed:** 13-16 (11 plans total)

**Key accomplishments:**

- Aligned attachment delete UI with RLS policy (own files or admin/quartermaster)
- Added QMHQ fulfillment progress tracking with FulfillmentProgressBar component
- Standardized number inputs (no auto-format on blur, format on submit only)
- Created CurrencyDisplay component for two-line original + EUSD format
- Added permission-gated Edit buttons to QMRL, QMHQ, PO detail pages
- Implemented status change notes with RPC function and trigger deduplication

**Stats:**

- 29 files modified (+1,502/-426 lines)
- ~34,232 lines of TypeScript
- 4 phases, 11 plans
- 1 day from start to ship

**Git range:** `ec62367` → `00fa689`

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---

## v1.2 Inventory & Financial Accuracy (Shipped: 2026-01-31)

**Delivered:** Currency-aware WAC calculations, comprehensive inventory dashboard, warehouse detail enhancements, and invoice void cascade with audit logging.

**Phases completed:** 7-12 (14 plans total)

**Key accomplishments:**

- Added currency selection and exchange rate to manual stock-in with EUSD display
- Built inventory dashboard with transaction history, KPIs, and filters
- Enhanced warehouse detail with per-item WAC and EUSD values
- Implemented invoice void cascade with immediate UI feedback
- Established EUSD-only display pattern across financial views

**Stats:**

- 4 phases (7-12 including 7.1 inserted)
- 14 plans total
- Shipped 2026-01-31

**Git range:** v1.1 → v1.2

**What's next:** v1.3 UX & Bug Fixes

---

## v1.1 Enhancement (Shipped: 2026-01-28)

**Delivered:** Critical bug fixes for PO/stock-in workflows, file attachments with preview, management dashboard, and quick status UX improvements.

**Phases completed:** 1-6 (17 plans total)

**Key accomplishments:**

- Fixed critical PO creation and stock-in workflows with enhanced error handling
- Built secure file storage infrastructure with RLS and 25MB limit
- Implemented drag-drop file uploads with thumbnail previews
- Created in-app image zoom and PDF page navigation preview
- Built live management dashboard with KPIs, alerts, and activity feeds
- Added quick status changes via clickable badges with audit logging

**Stats:**

- 88 files created/modified
- ~31,689 lines of TypeScript
- 6 phases, 17 plans
- 2 days from start to ship

**Git range:** `bde478c` → `a15d256`

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---

## v1.6 Stock-Out Approval & Data Integrity (Shipped: 2026-02-10)

**Delivered:** Stock-out request/approval workflow with partial approval and atomic execution, deletion protection for 6 entity types, user deactivation with login blocking, and context sliders for QMHQ and stock-out pages.

**Phases completed:** 27-31 (12 plans total)

**Key accomplishments:**

- Built stock-out approval workflow from DB schema (3 tables, RLS, audit) through full UI (request, approve, reject, execute)
- Added cross-warehouse stock validation at request, approval, and execution time with over-execution prevention
- Implemented QMHQ integration with Request Stock-Out button and Stock-Out Status card showing requested/approved quantities
- Created deletion protection triggers for items, statuses, categories, departments, contacts, and suppliers (16 reference checks)
- Added user deactivation with API routes, middleware login blocking, session termination, and admin reactivation
- Built reusable context slider pattern with QMRL/QMHQ content on stock-out request and QMHQ create pages

**Stats:**

- 86 files modified
- ~42,600 lines of TypeScript (up from ~37,400)
- 5 phases, 12 plans, 21 feat commits
- 2 days from start to ship (2026-02-09 → 2026-02-10)

**Git range:** `bda48f6` → `c2f10b7`

**Tech debt accepted:** CSLR-02/CSLR-03 (approval/execution page sliders) deferred; PO Edit page still 404

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---


## v1.7 Stock-Out Request Logic Repair (Shipped: 2026-02-11)

**Delivered:** Per-line-item stock-out execution replacing whole-request atomic execution, QMHQ transaction linking with SOR-grouped display, dual reference display (SOR primary + QMHQ secondary), database trigger hardening with advisory locks, and aggregate fulfillment metrics.

**Phases completed:** 32-35 (7 plans total)

**Key accomplishments:**

- Built SOR-grouped transaction display with stepped progress visualization (Requested → Approved → Executed) on QMHQ item detail
- Added dual reference display — SOR approval number (primary badge) + parent QMHQ ID (secondary link) with clickable navigation
- Hardened database triggers with advisory locks, row-level locking, and idempotency constraints for concurrent execution safety
- Auto-populated QMHQ link from SOR chain with backfill migration and duplicate cleanup
- Replaced whole-request execution with per-approval Execute buttons, stock pre-check, confirmation dialog, and cross-tab sync
- Created FulfillmentMetrics component showing Requested/Approved/Rejected/Executed aggregates with real-time cross-tab updates

**Stats:**

- 42 files modified (+7,902/-550 lines)
- ~43,976 lines of TypeScript
- 4 phases, 7 plans, 13 feat commits
- 1 day from start to ship (2026-02-11)

**Git range:** `ccc88b5` → `24c2864`

**Tech debt accepted:** PO Edit page still 404; context slider deferred for approval/execution pages

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---


## v1.8 UI Consistency, Flow Tracking & RBAC (Shipped: 2026-02-12)

**Delivered:** Standardized UI/UX across all pages with 7 composite components, overhauled RBAC from 7 roles to 3 (Admin/QMRL/QMHQ) with 92 RLS policies, and built admin-only end-to-end flow tracking page.

**Phases completed:** 36-40 (15 plans total)

**Key accomplishments:**

- Created 7 composite UI components (PageHeader, FilterBar, ActionButtons, FormField, FormSection, DetailPageLayout, CardViewGrid) and migrated 32 pages
- Migrated database RBAC from 7-role to 3-role (admin/qmrl/qmhq) using expand-and-contract pattern with zero data loss
- Recreated 92 RLS policies and updated all frontend permission checks for 3-role model
- Built admin-only end-to-end flow tracking page with QMRL → QMHQ → PO → Invoice → Stock chain visualization
- Standardized UI across 25+ list pages, 7 detail pages, and 10 form pages with surgical JSX replacement

**Stats:**

- 101 files modified (+15,611/-2,889 lines)
- ~45,196 lines of TypeScript
- 5 phases, 15 plans, 35 commits
- 2 days from start to ship (2026-02-11 → 2026-02-12)

**Git range:** `5864080` → `d9cddda`

**Tech debt accepted:** Flow tracking VIEW performance unknown at scale; PO Edit page still 404; context slider deferred for approval/execution pages

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---


## v1.9 PO Lifecycle, Cancellation Guards & PDF Export (Shipped: 2026-02-13)

**Delivered:** PO smart status engine with 6-state lifecycle, cancellation/void guards enforced at DB and UI levels, admin-only closed PO unlock, PO Matching tab with variance highlighting, per-line-item progress bars, and professional dark-themed PDF receipt export for invoices, stock-out requests, and money-out transactions.

**Phases completed:** 41-43 (8 plans total)

**Key accomplishments:**

- Built PO smart status engine with 6-state auto-calculation (not_started → partially_invoiced → awaiting_delivery → partially_received → closed → cancelled) triggered by invoice/stock-in events
- Added PO cancellation guard (blocks when active invoices exist) and invoice void guard (blocks when stock-in exists) at both database trigger and UI tooltip levels
- Implemented admin-only closed PO unlock with automatic re-lock on status recalculation
- Created PO Matching tab with side-by-side PO vs Invoice vs Stock-In comparison, variance highlighting, and voided invoice toggle
- Built per-line-item stepped progress bars showing ordered vs invoiced vs received quantities
- Shipped professional dark-themed PDF receipt export for invoices (with PO reference and receiving progress), stock-out requests (with approval chain audit trail), and QMHQ money-out transactions

**Stats:**

- 83 files modified (+13,242/-1,109 lines)
- ~49,034 lines of TypeScript
- 3 phases, 8 plans, 17 feat commits
- 1 day from start to ship (2026-02-12 → 2026-02-13)

**Git range:** `4ed4a75` → `4910e33`

**Tech debt accepted:** PO Edit page still 404; context slider deferred for approval/execution pages; flow tracking VIEW performance unknown at scale

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---


## v1.10 Tech Debt Cleanup (Shipped: 2026-02-14)

**Delivered:** PO header editing with status guards and audit logging, flow tracking VIEW performance optimization with 8 partial indexes, and JSDoc-annotated composite component prop interfaces documenting type contracts.

**Phases completed:** 44-46 (3 plans total)

**Key accomplishments:**

- Created PO edit page with header-only editing (supplier, notes, delivery date, signers) — line items and amounts immutable
- Added status-based edit guards blocking closed/cancelled PO editing with clear block messages
- Built 8 partial indexes on FK columns and eliminated OR join in flow tracking VIEW for production-scale performance
- Added loading skeleton and Suspense boundary for non-blocking flow tracking page loads
- Documented all 24 composite component props with JSDoc annotations codifying ReactNode vs string type contracts

**Stats:**

- 19 files modified (+2,653/-50 lines)
- ~49,804 lines of TypeScript
- 3 phases, 3 plans
- 1 day from start to ship (2026-02-14)

**Git range:** `22a2ad9` → `cfdb4b9`

**Tech debt resolved:** PO Edit page 404 (created), flow tracking VIEW performance (indexed), composite prop types (documented)

**What's next:** TBD — run `/gsd:new-milestone` to define next goals

---

