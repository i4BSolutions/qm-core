---
phase: 14-currency-number-input-standardization
plan: 04
subsystem: forms
tags: [number-input, po, invoice, transaction, keydown-handlers]

dependency_graph:
  requires:
    - "14-01 (number input utilities)"
  provides:
    - "Standardized PO form number inputs"
    - "Standardized Invoice form number inputs"
    - "Standardized Transaction dialog number inputs"
  affects:
    - "All PO/Invoice creation workflows"

tech_stack:
  added: []
  patterns:
    - "Centralized keydown handler imports from lib/utils"
    - "type=text with inputMode for mobile keyboard support"

key_files:
  created: []
  modified:
    - "app/(dashboard)/po/new/page.tsx"
    - "app/(dashboard)/invoice/new/page.tsx"
    - "components/po/po-line-items-table.tsx"
    - "components/invoice/invoice-line-items-table.tsx"
    - "components/qmhq/transaction-dialog.tsx"

decisions:
  - id: "14-04-01"
    decision: "Replace type=number with type=text + inputMode"
    rationale: "Better control over input behavior, prevents browser number input quirks"
  - id: "14-04-02"
    decision: "Show empty string for zero values in quantity/price inputs"
    rationale: "Cleaner UX - users see placeholder instead of 0"

metrics:
  duration: "2m 57s"
  completed: "2026-02-02"
---

# Phase 14 Plan 04: PO & Invoice Form Number Input Standardization Summary

Applied centralized number input keydown handlers to PO create, Invoice create, and Transaction dialog forms to ensure consistent decimal limiting and character blocking across all financial inputs.

## What Was Updated

### PO Create Page (`app/(dashboard)/po/new/page.tsx`)

| Input | Handler | Limits |
|-------|---------|--------|
| Exchange Rate | `handleExchangeRateKeyDown` | 4 decimal places |

### PO Line Items Table (`components/po/po-line-items-table.tsx`)

| Input | Handler | Limits |
|-------|---------|--------|
| Quantity | `handleQuantityKeyDown` | Integers only |
| Unit Price | `handleAmountKeyDown` | 2 decimal places |

### Invoice Create Page (`app/(dashboard)/invoice/new/page.tsx`)

| Input | Handler | Limits |
|-------|---------|--------|
| Exchange Rate | `handleExchangeRateKeyDown` | 4 decimal places |
| Line Item Qty (inline) | `handleQuantityKeyDown` | Integers only |
| Line Item Price (inline) | `handleAmountKeyDown` | 2 decimal places |

### Invoice Line Items Table (`components/invoice/invoice-line-items-table.tsx`)

| Input | Handler | Limits |
|-------|---------|--------|
| Quantity | `handleQuantityKeyDown` | Integers only |
| Unit Price | `handleAmountKeyDown` | 2 decimal places |

### Transaction Dialog (`components/qmhq/transaction-dialog.tsx`)

| Input | Handler | Limits |
|-------|---------|--------|
| Amount | `handleAmountKeyDown` | 2 decimal places |
| Exchange Rate | `handleExchangeRateKeyDown` | 4 decimal places |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7a25a71 | feat | Standardize PO form number inputs |
| 28fd919 | feat | Standardize Invoice form number inputs |
| d067b0c | feat | Standardize transaction dialog number inputs |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] PO create page uses handleExchangeRateKeyDown
- [x] PO line items table uses handleQuantityKeyDown and handleAmountKeyDown
- [x] Invoice create page uses handleExchangeRateKeyDown
- [x] Invoice inline line items use handleQuantityKeyDown and handleAmountKeyDown
- [x] Invoice line items table uses handleQuantityKeyDown and handleAmountKeyDown
- [x] Transaction dialog uses handleAmountKeyDown and handleExchangeRateKeyDown
- [x] npm run type-check passes
- [x] npm run lint passes (pre-existing error in unrelated file)

## Next Phase Readiness

All PO, Invoice, and Transaction forms now have consistent number input behavior. Users cannot type invalid characters (-, e, E, +) and decimal places are limited appropriately while typing.
