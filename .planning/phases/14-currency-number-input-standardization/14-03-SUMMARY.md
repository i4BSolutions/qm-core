---
phase: 14-currency-number-input-standardization
plan: 03
subsystem: forms
tags: [number-input, keydown-handlers, inventory, qmhq]

dependency_graph:
  requires:
    - "14-01 (number input utilities)"
  provides:
    - "Standardized number input behavior for inventory and QMHQ forms"
  affects:
    - "14-04 (PO & Invoice forms)"

tech_stack:
  added: []
  patterns:
    - "Centralized keydown handler import from lib/utils"
    - "type='text' with inputMode for mobile-friendly number inputs"

key_files:
  created: []
  modified:
    - "app/(dashboard)/inventory/stock-in/page.tsx"
    - "app/(dashboard)/inventory/stock-out/page.tsx"
    - "app/(dashboard)/qmhq/new/[route]/page.tsx"

decisions:
  - id: "14-03-01"
    decision: "Use type='text' with inputMode instead of type='number'"
    rationale: "Avoids browser number input quirks while providing mobile keyboard hints"
  - id: "14-03-02"
    decision: "Remove placeholder text from number inputs"
    rationale: "Empty inputs should show blank, not '0' or '0.00'"

metrics:
  duration: "4m 12s"
  completed: "2026-02-02"
---

# Phase 14 Plan 03: Inventory & QMHQ Form Standardization Summary

Applied centralized number input keydown handlers to inventory forms (stock-in, stock-out) and QMHQ route forms, ensuring consistent blocking of invalid characters during typing.

## What Was Built

### Stock-In Form (8 handler usages)
- Invoice line item quantity inputs: `handleQuantityKeyDown`
- Invoice line item unit cost inputs: `handleAmountKeyDown`
- Manual mode quantity input: `handleQuantityKeyDown`
- Manual mode unit cost input: `handleAmountKeyDown`
- Manual mode exchange rate input: `handleExchangeRateKeyDown`

### Stock-Out Form (2 handler usages)
- Quantity input: `handleQuantityKeyDown`

### QMHQ Route Form (8 handler usages)
- Item route quantity input: `handleQuantityKeyDown`
- Expense route amount input: `handleAmountKeyDown`
- Expense route exchange rate input: `handleExchangeRateKeyDown`
- PO route budget amount input: `handleAmountKeyDown`
- PO route exchange rate input: `handleExchangeRateKeyDown`

## Input Pattern Changes

| Before | After |
|--------|-------|
| `type="number"` | `type="text"` |
| inline onKeyDown | centralized handler |
| `placeholder="0.00"` | no placeholder |
| `min`, `max`, `step` attrs | N/A (handled by keydown) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 16b2c5e | feat | Apply standardized number input handlers to stock-in form |
| 2014773 | feat | Apply standardized quantity input handler to stock-out form |
| 5003da6 | feat | Apply standardized number input handlers to QMHQ route form |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Stock-in page imports and uses all three handlers
- [x] Stock-out page imports and uses handleQuantityKeyDown
- [x] QMHQ route page imports and uses all three handlers as appropriate
- [x] npm run type-check passes

## Next Phase Readiness

Ready for 14-04: PO and Invoice forms can follow the same pattern to apply centralized handlers.
