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
