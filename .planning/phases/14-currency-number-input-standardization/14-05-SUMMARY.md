---
phase: 14-currency-number-input-standardization
plan: 05
subsystem: ui-display
tags: [currency-display, two-line-format, cards, list-views]
dependency-graph:
  requires: [14-02]
  provides: [card-currency-display, list-page-currency-display]
  affects: [14-06, 14-07]
tech-stack:
  added: []
  patterns:
    - CurrencyDisplay component usage in cards
    - Two-line stacked format (original + EUSD)
file-tracking:
  key-files:
    created: []
    modified:
      - components/po/po-card.tsx
      - components/invoice/invoice-card.tsx
      - components/invoice/invoice-summary-panel.tsx
      - app/(dashboard)/qmhq/page.tsx
      - app/(dashboard)/po/page.tsx
      - app/(dashboard)/invoice/page.tsx
decisions:
  - key: summary-panel-preservation
    choice: Keep detailed breakdown format for InvoiceSummaryPanel
    reason: Summary panels benefit from showing individual values (original, exchange rate, EUSD)
  - key: balance-panel-preservation
    choice: Keep POBalancePanel as EUSD-only
    reason: Balance validation calculations operate in EUSD for consistency
metrics:
  duration: ~8min
  completed: 2026-02-02
---

# Phase 14 Plan 05: Card & List Currency Display Summary

CurrencyDisplay component applied to PO cards, Invoice cards, QMHQ list, and list view tables for consistent two-line currency format.

## Changes Made

### Task 1: Update Card Components

**PO Card (`components/po/po-card.tsx`)**
- Replaced EUSD-only display with CurrencyDisplay component
- Shows `total_amount` in original currency with `total_amount_eusd` below
- Two-line stacked format: original currency on top, EUSD in smaller muted text below

**Invoice Card (`components/invoice/invoice-card.tsx`)**
- Consolidated currency display into single CurrencyDisplay component
- Previously showed EUSD first with original currency below - now uses standard two-line format
- Original currency on top, EUSD below

### Task 2: Update Summary/Balance Panels

**InvoiceSummaryPanel (`components/invoice/invoice-summary-panel.tsx`)**
- Main panel preserved - detailed breakdown format appropriate for summary view
- `InvoiceTotalsInline` component updated to use CurrencyDisplay
- Provides consistent two-line format for inline total displays

**POBalancePanel** - Preserved as-is
- Balance validation operates in EUSD only
- Shows Available Balance, PO Total, Remaining After PO - all in EUSD
- Detailed breakdown format appropriate for balance checking

### Task 3: Update List Pages

**QMHQ Page (`app/(dashboard)/qmhq/page.tsx`)**
- Card view: expense/PO route items show two-line currency format
- List view: Amount column uses CurrencyDisplay with right alignment
- Item route items correctly skip currency display (no financial amounts)

**PO Page (`app/(dashboard)/po/page.tsx`)**
- Card view: delegates to updated POCard component
- List view: Amount column updated to use CurrencyDisplay

**Invoice Page (`app/(dashboard)/invoice/page.tsx`)**
- Card view: delegates to updated InvoiceCard component
- List view: Amount column updated to use CurrencyDisplay

## Verification Results

| Criterion | Status |
|-----------|--------|
| PO card shows original currency on top, EUSD below | Pass |
| Invoice card shows original currency on top, EUSD below | Pass |
| QMHQ list items show two-line format for financial routes | Pass |
| Summary panels maintain clarity | Pass |
| npm run type-check passes | Pass |
| All formatted amounts have thousand separators | Pass |

## Commits

| Hash | Message |
|------|---------|
| 65e5087 | feat(14-05): update PO and Invoice cards with CurrencyDisplay |
| 1cfeeb9 | feat(14-05): update InvoiceTotalsInline with CurrencyDisplay |
| 9079e34 | feat(14-05): update QMHQ, PO, Invoice list pages with CurrencyDisplay |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Remaining plans in Phase 14:**
- Plan 06: Form currency inputs (QMHQ, PO, Invoice forms)
- Plan 07: Financial panels and detail pages

**Dependencies satisfied:** CurrencyDisplay component now widely used across card and list views, establishing the two-line format pattern for the application.
