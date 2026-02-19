---
status: resolved
trigger: "conv-rate-decimal-and-standard-qty"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:05:00Z
---

## Current Focus

hypothesis: RESOLVED
test: COMPLETE
expecting: N/A
next_action: DONE

## Symptoms

expected: |
  1. Conversion rate input fields accept decimal values (e.g., 0.5, 1.25, 2.5)
  2. Everywhere a conversion rate is shown, also display: standard_qty = quantity × conversion_rate, and the item's standard unit name

actual: |
  1. Conv. rate input DOES accept decimals (AmountInput with decimalScale={4} via react-number-format — NO BUG HERE)
  2. standard_qty and standard unit name NOT shown when conversion_rate < 1 (gated by `> 1` check)

errors: No error messages reported — it's a UX/input limitation + missing display fields

reproduction: |
  1. Enter conversion rate of 0.5
  2. Standard qty (qty * 0.5) is not shown — hidden by `> 1` guard

started: Likely since the standard unit system was implemented (v1.11)

## Eliminated

- hypothesis: AmountInput/ConversionRateInput doesn't allow decimals
  evidence: ConversionRateInput uses AmountInput with decimalScale={4} via react-number-format, which handles decimals correctly. No bug here.
  timestamp: 2026-02-19

## Evidence

- timestamp: 2026-02-19
  checked: components/ui/conversion-rate-input.tsx
  found: Uses AmountInput with decimalScale={4} — decimals are fully supported at input level
  implication: Input decimal issue may not be a real bug; the real issue is display gating

- timestamp: 2026-02-19
  checked: All files with conversion_rate display
  found: "conversion_rate > 1" used as guard in ~25 places across 10+ files
  implication: Standard qty display hidden when rate is 0 < x < 1 (e.g., 0.5)

- timestamp: 2026-02-19
  checked: StandardUnitDisplay component (line 70)
  found: `const showSecondLine = unitName && unitName.trim() !== "" && conversionRate > 1;`
  implication: The shared display component also uses > 1 guard

## Resolution

root_cause: |
  The condition `conversion_rate > 1` was used throughout as a guard to determine whether to show the standard unit conversion display. This was designed assuming conversion rates are always >= 1 (e.g., 1 box = 12 pieces).

  When a decimal rate like 0.5 is entered (e.g., 1 piece = 0.5 kg), the guard `> 1` evaluates to false, hiding the standard qty display entirely.

  The correct condition is: `conversion_rate !== 1 && conversion_rate > 0` — meaning a meaningful conversion exists (not identity/not zero).

fix: |
  Replaced all `conversion_rate > 1` / `conversionRate > 1` / `parseFloat(...) > 1` checks with `!== 1 && > 0` checks across all affected files.

verification: |
  - TypeScript type check: exit 0 (no errors)
  - ESLint: exit 0 (only pre-existing warnings unrelated to this change)
  - All 25+ instances of the > 1 guard confirmed replaced via grep (0 remaining)

files_changed:
  - components/ui/standard-unit-display.tsx
  - app/(dashboard)/qmhq/[id]/page.tsx
  - app/(dashboard)/qmhq/new/[route]/page.tsx
  - app/(dashboard)/warehouse/[id]/page.tsx
  - app/(dashboard)/inventory/page.tsx
  - app/(dashboard)/inventory/stock-in/page.tsx
  - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  - app/(dashboard)/invoice/new/page.tsx
  - components/po/po-line-items-table.tsx
  - components/po/po-matching-tab.tsx
  - components/stock-out-requests/warehouse-assignments-tab.tsx
  - components/stock-out-requests/l2-warehouse-dialog.tsx
  - components/stock-out-requests/l1-approval-dialog.tsx
  - components/stock-out-requests/ready-execute-tab.tsx
  - components/invoice/invoice-line-items-table.tsx
  - components/invoice/invoice-po-selector.tsx
