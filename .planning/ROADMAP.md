# Roadmap: QM System

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-27)
- ✅ **v1.1 Enhancement** - Phases 5-10 (shipped 2026-01-28)
- ✅ **v1.2 Inventory & Financial Accuracy** - Phases 11-16 (shipped 2026-01-31)
- ✅ **v1.3 UX & Bug Fixes** - Phases 17-19 (shipped 2026-02-02)
- ✅ **v1.4 UX Enhancements & Workflow Improvements** - Phases 20-22 (shipped 2026-02-06)
- ✅ **v1.5 UX Polish & Collaboration** - Phases 23-26 (shipped 2026-02-09)
- ✅ **v1.6 Stock-Out Approval & Data Integrity** - Phases 27-31 (shipped 2026-02-10)
- 🚧 **v1.7 Stock-Out Request Logic Repair** - Phases 32-35 (in progress)

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

### 🚧 v1.7 Stock-Out Request Logic Repair (In Progress)

**Milestone Goal:** Fix stock-out execution to work per line item instead of per request, connect QMHQ item detail to stock-out transactions properly, and display correct references (SOR primary, QMHQ secondary).

#### Phase 32: QMHQ Transaction Linking
**Goal**: Stock-out transactions are linked to parent QMHQ via qmhq_id FK propagation
**Depends on**: Phase 31 (v1.6 shipped)
**Requirements**: LINK-01
**Success Criteria** (what must be TRUE):
  1. When admin approves a stock-out request linked to a QMHQ, the created inventory transaction has qmhq_id populated
  2. QMHQ item detail page shows stock-out transactions for that QMHQ (via qmhq_id link)
  3. Manual stock-out requests (no QMHQ parent) create transactions with NULL qmhq_id
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md — Create SOR transaction group and items summary progress bar components
- [x] 32-02-PLAN.md — Integrate SOR-grouped display and stepped progress bar into QMHQ detail page

#### Phase 33: Dual Reference Display
**Goal**: Users can see both SOR ID and parent QMHQ ID on stock-out transactions
**Depends on**: Phase 32 (qmhq_id populated in transactions)
**Requirements**: REF-01, REF-02, LINK-02
**Success Criteria** (what must be TRUE):
  1. Stock-out transactions show SOR approval number as primary reference (e.g., "SOR-2026-00001")
  2. When transaction is linked to a QMHQ, secondary reference displays parent QMHQ ID (e.g., "via QMHQ-2026-00042")
  3. Both SOR and QMHQ references are clickable links to their respective detail pages
  4. QMHQ item detail displays linked stock-out transactions in a dedicated table
**Plans:** 1 plan

Plans:
- [x] 33-01-PLAN.md — Dual reference display on transactions and linked transactions table

#### Phase 34: Database Trigger Hardening
**Goal**: Database integrity guarantees prevent race conditions and orphaned records during per-line execution
**Depends on**: Phase 33 (display foundation ready)
**Requirements**: None (infrastructure for EXEC-01/02)
**Success Criteria** (what must be TRUE):
  1. Concurrent execution of multiple line items does not create negative stock (advisory locks serialize validation)
  2. Parent request status always reflects accurate aggregation of child line item statuses (row-level locking prevents stale reads)
  3. Cannot create inventory transaction without valid stock_out_approval_id when movement_type is 'inventory_out' with reason 'request'
  4. QMHQ link auto-populates from SOR when transaction is created (no orphaned transactions)
  5. Cannot execute the same approval twice (idempotency constraint prevents duplicates)
**Plans:** 2 plans

Plans:
- [x] 34-01-PLAN.md — Advisory locks on stock/fulfillment validation, row lock on status aggregation, CHECK constraint for approval requirement
- [x] 34-02-PLAN.md — QMHQ auto-population trigger and idempotency constraint for execution

#### Phase 35: Per-Line-Item Execution UI
**Goal**: Each approved stock-out line item can be executed independently
**Depends on**: Phase 34 (triggers deployed)
**Requirements**: EXEC-01, EXEC-02, METRIC-01, METRIC-02, METRIC-03, METRIC-04, METRIC-05, METRIC-06
**Success Criteria** (what must be TRUE):
  1. Each approved line item has its own Execute button (not just request-level)
  2. Executing one line item changes only that line's status (other approved items remain unchanged)
  3. QMHQ item detail shows requested qty (sum of SOR line items)
  4. QMHQ item detail shows approved qty (sum of approvals)
  5. QMHQ item detail shows rejected qty (sum of rejections)
  6. QMHQ item detail shows executed/fulfilled qty (sum of stock-out transactions)
  7. Fulfillment Progress on QMHQ detail calculates as (executed qty / approved qty) with requested qty visible
**Plans:** 2 plans

Plans:
- [ ] 35-01-PLAN.md — Per-approval execution buttons on SOR detail page with stock pre-check and confirmation dialog
- [ ] 35-02-PLAN.md — FulfillmentMetrics component on QMHQ item detail page with cross-tab sync

## Progress

**Execution Order:**
Phases execute in numeric order: 32 → 33 → 34 → 35

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4. Foundation → Audit | v1.0 | 8/8 | ✓ Complete | 2026-01-27 |
| 5-10. Bugs → UX Polish | v1.1 | 17/17 | ✓ Complete | 2026-01-28 |
| 11-16. WAC → Void Cascade | v1.2 | 14/14 | ✓ Complete | 2026-01-31 |
| 17-19. Attach → Audit Notes | v1.3 | 11/11 | ✓ Complete | 2026-02-02 |
| 20-22. Upload → Validation | v1.4 | 9/9 | ✓ Complete | 2026-02-06 |
| 23-26. Comments → Currency | v1.5 | 9/9 | ✓ Complete | 2026-02-09 |
| 27-31. Stock-Out → Sliders | v1.6 | 12/12 | ✓ Complete | 2026-02-10 |
| 32. QMHQ Transaction Linking | v1.7 | 2/2 | ✓ Complete | 2026-02-11 |
| 33. Dual Reference Display | v1.7 | 1/1 | ✓ Complete | 2026-02-11 |
| 34. Database Trigger Hardening | v1.7 | 2/2 | ✓ Complete | 2026-02-11 |
| 35. Per-Line-Item Execution UI | v1.7 | 0/? | Not started | - |
