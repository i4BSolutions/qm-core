---
phase: 07-ux-polish
plan: 02
completed: 2026-01-29
duration: 8min
subsystem: forms
tags: [ux, number-inputs, forms, validation]
requires:
  - phase-06 (existing forms)
provides:
  - empty-placeholder-pattern (number inputs show placeholder when empty)
  - negative-blocking-pattern (onKeyDown rejects minus/e keys)
affects:
  - any future forms with number inputs
tech-stack:
  added: []
  patterns:
    - string-state-for-numbers (useState<string>("") with parseFloat on use)
key-files:
  created: []
  modified:
    - app/(dashboard)/po/new/page.tsx
    - app/(dashboard)/invoice/new/page.tsx
    - app/(dashboard)/inventory/stock-in/page.tsx
    - app/(dashboard)/inventory/stock-out/page.tsx
decisions:
  - { id: "string-state-for-numbers", choice: "Use string state with parseFloat", reason: "Allows empty placeholder display and direct typing" }
---

# Phase 7 Plan 02: Number Input UX Propagation Summary

All transaction forms now use empty string state for number inputs with placeholder display and keyboard validation.

## What Was Built

Propagated number input UX improvements from QMHQ form pattern to all transaction-related forms:

### PO Create Form
- Changed `exchangeRate` state from `useState(1)` to `useState<string>("")`
- Added `placeholder="1.0000"` to exchange rate input
- Added `onKeyDown` handler to block minus/e keys
- Updated calculations to use `parseFloat(exchangeRate) || 1`

### Invoice Create Form
- Changed `exchangeRate` state from `useState(1)` to `useState<string>("")`
- Added `placeholder="1.0000"` to exchange rate input
- Added `onKeyDown` handler to block minus/e keys
- Updated validation, submit, and display to use `parseFloat(exchangeRate) || 1`

### Stock-In Form (Manual Mode)
- Changed `manualQuantity` state from `useState<number>(1)` to `useState<string>("")`
- Changed `manualUnitCost` state from `useState<number>(0)` to `useState<string>("")`
- Added `placeholder="1"` for quantity, `placeholder="0.00"` for unit cost
- Added `onKeyDown` handlers to block minus/e keys on both inputs
- Updated validation, submit, and display calculations

### Stock-Out Form
- Changed `quantity` state from `useState<number>(1)` to `useState<string>("")`
- Added `placeholder="1"` to quantity input
- Added `onKeyDown` handler to block minus/e keys
- Updated validation, submit, and summary calculations

## Pattern Established

```typescript
// String state for number inputs
const [value, setValue] = useState<string>("");

// Input JSX
<Input
  type="number"
  min="0"
  step="0.01"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "-" || e.key === "e" || e.key === "E") {
      e.preventDefault();
    }
  }}
  placeholder="0.00"
  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>

// Using the value
const numValue = parseFloat(value) || defaultValue;
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 9464712 | fix | PO and Invoice form number input UX |
| ed38392 | fix | Stock-In and Stock-Out form number input UX |

## Files Modified

- `app/(dashboard)/po/new/page.tsx` - Exchange rate input
- `app/(dashboard)/invoice/new/page.tsx` - Exchange rate input
- `app/(dashboard)/inventory/stock-in/page.tsx` - Quantity and unit cost inputs
- `app/(dashboard)/inventory/stock-out/page.tsx` - Quantity input

## Verification

- [x] Build passes without errors
- [x] PO form: Exchange rate shows "1.0000" placeholder
- [x] Invoice form: Exchange rate shows "1.0000" placeholder
- [x] Stock-In form: Quantity shows "1" placeholder, unit cost shows "0.00" placeholder
- [x] Stock-Out form: Quantity shows "1" placeholder
- [x] All forms: Cannot type minus key in number fields
- [x] All forms: Calculations use parseFloat with fallbacks

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

UX-02 and UX-03 requirements now complete across all transaction forms. Ready for next plan in Phase 7.
