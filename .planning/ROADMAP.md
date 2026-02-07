# Roadmap: QM System v1.5

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-27)
- ✅ **v1.1 Enhancement** - Phases 5-10 (shipped 2026-01-28)
- ✅ **v1.2 Inventory & Financial Accuracy** - Phases 11-16 (shipped 2026-01-31)
- ✅ **v1.3 UX & Bug Fixes** - Phases 17-19 (shipped 2026-02-02)
- ✅ **v1.4 UX Enhancements & Workflow Improvements** - Phases 20-22 (shipped 2026-02-06)
- 🚧 **v1.5 UX Polish & Collaboration** - Phases 23-26 (in progress)

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

### 🚧 v1.5 UX Polish & Collaboration (In Progress)

**Milestone Goal:** Improve amount display responsiveness, add team collaboration via comments, streamline PO item selection with category filtering, and unify QMHQ currency handling.

#### ✅ Phase 23: Comments System (Completed 2026-02-07)

**Goal**: Users can collaborate via threaded comments on QMRL, QMHQ, PO, and Invoice detail pages with role-based visibility

**Depends on**: None (first v1.5 phase)

**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, COMM-06, COMM-07, COMM-08, COMM-09

**Success Criteria** (what must be TRUE):
  1. ✓ User can add comments on any QMRL/QMHQ/PO/Invoice detail page
  2. ✓ User can reply to existing comments (one level only)
  3. ✓ User can delete own comments with soft delete preservation
  4. ✓ Comments display author name, timestamp, and chronological ordering
  5. ✓ Comments follow existing entity RLS rules (user sees only what entity permissions allow)

**Plans**: 3 plans

Plans:
- [x] 23-01-PLAN.md — Database schema, RLS policies, TypeScript types
- [x] 23-02-PLAN.md — Comments UI components (section, card, input, dialog)
- [x] 23-03-PLAN.md — Integration into QMRL/QMHQ/PO/Invoice detail pages

#### ✅ Phase 24: Responsive Typography (Completed 2026-02-07)

**Goal**: Amount displays adapt to viewport and number size without overflow or loss of precision

**Depends on**: None (can run parallel to Phase 23)

**Requirements**: TYPO-01, TYPO-02, TYPO-03

**Success Criteria** (what must be TRUE):
  1. ✓ Large amounts on cards use fluid font scaling that adapts to container size
  2. ✓ Very large numbers (1M+) abbreviate with K/M/B notation and show full value on hover
  3. ✓ Amount displays remain readable and properly formatted across mobile/tablet/desktop breakpoints

**Plans**: 2 plans

Plans:
- [x] 24-01-PLAN.md — Fluid font utilities and formatCompactCurrency
- [x] 24-02-PLAN.md — Enhanced CurrencyDisplay and card updates

#### ✅ Phase 25: Two-Step Selectors (Completed 2026-02-08)

**Goal**: PO line item selection uses category-first filtering to reduce item list complexity

**Depends on**: Phase 24 (benefits from responsive dropdown content)

**Requirements**: SLCT-01, SLCT-02, SLCT-03, SLCT-04, SLCT-05, SLCT-06, SLCT-07

**Success Criteria** (what must be TRUE):
  1. ✓ User selects category first in PO line item creation, then item selector filters by that category
  2. ✓ Both category and item selectors are searchable with clear visual states
  3. ✓ Changing category resets item selection and shows appropriate loading/empty states
  4. ✓ User can successfully create PO line items with category → item workflow

**Plans**: 2 plans

Plans:
- [x] 25-01-PLAN.md — Create reusable CategoryItemSelector component
- [x] 25-02-PLAN.md — Integrate into PO line items, stock-in, and stock-out pages

#### Phase 26: Currency Unification

**Goal**: QMHQ transactions inherit locked currency from parent QMHQ with balance tracking and validation warning

**Depends on**: None (independent but benefits from established patterns)

**Requirements**: CURR-01, CURR-02, CURR-03, CURR-04, CURR-05, CURR-06

**Success Criteria** (what must be TRUE):
  1. Money-in/out currency locked to QMHQ currency with visual indicator
  2. Exchange rate defaults from QMHQ but remains editable per transaction
  3. QMHQ detail pages and list cards show amounts in both org currency and EUSD
  4. Money-out form displays remaining balance (static, not real-time)
  5. Validation warns (not blocks) when money-out exceeds available balance

**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md — TransactionDialog currency inheritance and balance validation
- [ ] 26-02-PLAN.md — Dual currency display on QMHQ detail and list pages

## Progress

**Execution Order:**
Phases execute in numeric order: 23 → 24 → 25 → 26

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 23. Comments System | v1.5 | 3/3 | ✓ Complete | 2026-02-07 |
| 24. Responsive Typography | v1.5 | 2/2 | ✓ Complete | 2026-02-07 |
| 25. Two-Step Selectors | v1.5 | 2/2 | ✓ Complete | 2026-02-08 |
| 26. Currency Unification | v1.5 | 0/2 | Planned | - |
