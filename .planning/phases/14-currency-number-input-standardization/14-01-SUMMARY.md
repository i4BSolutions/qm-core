---
phase: 14-currency-number-input-standardization
plan: 01
subsystem: utilities
tags: [number-input, validation, keydown-handlers, utilities]

dependency_graph:
  requires: []
  provides:
    - "Number input keydown handlers for amount, exchange rate, quantity"
    - "Validation helpers for form submission"
    - "Parse helpers with proper rounding"
  affects:
    - "14-02 (currency input component)"
    - "All forms with number inputs"

tech_stack:
  added: []
  patterns:
    - "Keydown event blocking for input validation"
    - "Decimal place limiting via cursor position tracking"

key_files:
  created:
    - "lib/utils/number-input.ts"
  modified:
    - "lib/utils/index.ts"

decisions:
  - id: "14-01-01"
    decision: "Block invalid chars at keydown rather than on blur"
    rationale: "Prevents invalid input from ever appearing in field"
  - id: "14-01-02"
    decision: "Allow control keys and Ctrl/Cmd combinations"
    rationale: "Users need copy/paste, navigation, and text selection"
  - id: "14-01-03"
    decision: "Check cursor position relative to decimal for limit enforcement"
    rationale: "Allows editing digits before decimal even when at max decimals after"
  - id: "14-01-04"
    decision: "Parse helpers return safe defaults (0 for amounts/qty, 1 for rates)"
    rationale: "Prevents NaN propagation in calculations"

metrics:
  duration: "1m 17s"
  completed: "2026-02-02"
---

# Phase 14 Plan 01: Number Input Utilities Summary

Created reusable keydown handlers and validation utilities for controlled number inputs that block invalid characters during typing and limit decimal places appropriately.

## What Was Built

### Keydown Handlers (3 functions)

| Handler | Purpose | Blocks | Decimal Limit |
|---------|---------|--------|---------------|
| `handleAmountKeyDown` | Currency amounts | -, e, E, + | 2 places |
| `handleExchangeRateKeyDown` | Exchange rates | -, e, E, + | 4 places |
| `handleQuantityKeyDown` | Integer quantities | -, e, E, +, . | None (integers) |

All handlers:
- Allow navigation keys (arrows, backspace, delete, tab, etc.)
- Allow Ctrl/Cmd combinations (copy, paste, select all)
- Track cursor position to allow editing before decimal

### Validation Helpers (3 functions)

| Function | Returns true when |
|----------|-------------------|
| `validateAmount` | Valid positive number or empty string |
| `validateExchangeRate` | Valid positive number > 0 or empty string |
| `validateQuantity` | Valid positive integer or empty string |

### Parse Helpers (3 functions)

| Function | Rounding | Default |
|----------|----------|---------|
| `parseAmount` | 2 decimals | 0 |
| `parseExchangeRate` | 4 decimals | 1 |
| `parseQuantity` | Integer | 0 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| cde25d2 | feat | Create number input utilities for controlled inputs |
| 5b4f3af | chore | Re-export number input utilities from lib/utils |

## Deviations from Plan

None - plan executed exactly as written.

## How to Use

```typescript
import {
  handleAmountKeyDown,
  validateAmount,
  parseAmount,
} from "@/lib/utils";

// In a controlled input
<input
  type="text"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  onKeyDown={handleAmountKeyDown}
/>

// On form submit
if (!validateAmount(amount)) {
  toast.error("Invalid amount");
  return;
}
const parsedAmount = parseAmount(amount); // Rounded to 2 decimals
```

## Next Phase Readiness

Ready for 14-02: Currency input component can now import these handlers directly from `@/lib/utils` and wrap them in a reusable component pattern.
