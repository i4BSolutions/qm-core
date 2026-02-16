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
- 🚧 **v1.11 Standard Unit System** - Phases 47-50 (in progress)

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

### v1.11 Standard Unit System (In Progress)

**Milestone Goal:** Add system-wide standard unit for item quantities with per-transaction conversion rate and display everywhere, mirroring the EUSD pattern for currencies.

#### Phase 47: Schema & Data Foundation

**Goal**: Database supports per-transaction unit conversion rates with backfilled historical data

**Depends on**: Phase 46 (v1.10 complete)

**Requirements**: SINP-05

**Success Criteria** (what must be TRUE):
1. PO line items, invoice line items, inventory transactions, and stock-out request line items store conversion_rate and standard_qty
2. All existing transaction records have conversion_rate = 1 and standard_qty = qty
3. Database constraints enforce conversion_rate is required (NOT NULL) on new records
4. Generated columns automatically calculate standard_qty from qty × conversion_rate

**Plans:** 1 plan

Plans:
- [x] 47-01-PLAN.md -- Schema migration adding conversion_rate and standard_qty to 4 tables with backfill

#### Phase 48: Admin Configuration

**Goal**: Admin can configure the global standard unit name that appears throughout the system

**Depends on**: Phase 47

**Requirements**: SCONF-01, SCONF-02

**Success Criteria** (what must be TRUE):
1. Admin can set the standard unit name in admin settings page
2. Standard unit name persists in system configuration table
3. All display components retrieve the current standard unit name dynamically
4. System-wide standard unit name defaults to "Standard Units" if not configured

**Plans:** 1 plan

Plans:
- [x] 48-01-PLAN.md -- System config table, standard unit hook, and admin settings page

#### Phase 49: Conversion Rate Input

**Goal**: Users enter conversion rates on all quantity-based transactions

**Depends on**: Phase 48

**Requirements**: SINP-01, SINP-02, SINP-03, SINP-04

**Success Criteria** (what must be TRUE):
1. PO line item entry includes conversion rate input with validation (required, > 0)
2. Invoice line item entry includes conversion rate input with validation
3. Stock-in form includes conversion rate input for each transaction
4. Stock-out request line items include conversion rate input
5. Conversion rate input component mirrors ExchangeRateInput pattern (decimal precision, thousand separators)

**Plans:** 3 plans

Plans:
- [x] 49-01-PLAN.md -- ConversionRateInput component (mirrors ExchangeRateInput)
- [x] 49-02-PLAN.md -- PO and Invoice line item conversion rate integration
- [x] 49-03-PLAN.md -- Stock-in, stock-out, and stock-out request conversion rate integration

#### Phase 50: Standard Quantity Display

**Goal**: Standard quantities display alongside every quantity in the system

**Depends on**: Phase 49

**Requirements**: SDISP-01, SDISP-02, SDISP-03, SDISP-04, SDISP-05, SDISP-06, SDISP-07

**Success Criteria** (what must be TRUE):
1. PO detail shows standard qty (qty × rate) on each line item with two-line format
2. Invoice detail shows standard qty on each line item with two-line format
3. Inventory transaction lists show standard qty alongside quantity
4. Warehouse detail page shows standard qty on inventory rows
5. QMHQ item detail shows standard qty on stock-out displays
6. StandardUnitDisplay component mirrors CurrencyDisplay two-line pattern (qty + standard qty)
7. All existing transactions display with standard qty calculated from backfilled conversion_rate = 1

**Plans:** 4 plans

Plans:
- [ ] 50-01-PLAN.md -- StandardUnitDisplay component mirroring CurrencyDisplay two-line pattern
- [ ] 50-02-PLAN.md -- PO and Invoice readonly tables + Invoice PDF standard qty integration
- [ ] 50-03-PLAN.md -- Inventory dashboard, warehouse detail, and stock-out request standard qty
- [ ] 50-04-PLAN.md -- QMHQ detail, items summary, and PDF export wiring

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
| 47. Schema & Data Foundation | v1.11 | 1/1 | ✓ Complete | 2026-02-14 |
| 48. Admin Configuration | v1.11 | 1/1 | ✓ Complete | 2026-02-14 |
| 49. Conversion Rate Input | v1.11 | 3/3 | ✓ Complete | 2026-02-14 |
| 50. Standard Quantity Display | v1.11 | 0/4 | Not started | - |

---
*Last updated: 2026-02-15 after Phase 49 completion*
