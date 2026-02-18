---
status: resolved
trigger: "item-qty-decimals-and-base-unit-names"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T01:30:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: TypeScript type check passed (exit 0), ESLint no new errors
expecting: All quantity displays now integer-only for base units; "Atom" unit name no longer shown
next_action: Archive session

## Symptoms

expected:
- All item quantities displayed as integers (500, not 500.00)
- Quantity inputs use decimalScale=0
- Base items (no standard unit) do NOT show any unit name
- Only items with a standard unit show unit names

actual:
- Quantities display as "500.00 Atom", "300.00 Atom"
- Appears in QMHQ detail fulfillment metrics, items summary progress, SOR line items, approval dialogs
- Base items show "Atom" even when they shouldn't

errors: No errors — display/formatting issue
reproduction: Open any QMHQ item detail page or SOR detail page
timeline: Likely introduced with standard unit system (v1.11)

## Eliminated

(none — root cause confirmed directly through code reading)

## Evidence

- timestamp: 2026-02-18T01:00:00Z
  checked: All affected files
  found: Standard unit secondary display lines all lacked `conversion_rate > 1` guard. "Atom" standard unit has conversion_rate=1 so all items without a real standard unit would show "500.00 Atom".

## Resolution

root_cause: |
  Two related root causes sharing the same mechanism:
  1. Standard unit secondary display lines (e.g. "= 500.00 Atom") lacked a `conversion_rate > 1` guard.
     The "Atom" standard unit (and "pcs" default) has conversion_rate=1. Without the guard, the secondary
     line displayed for ALL items, including base items, showing the base quantity with 2 decimal places
     and the unit name "Atom".
  2. In some cases, the `unit_name` was passed down to components from the data layer without filtering
     out the base-unit case (conversion_rate <= 1), causing the component to render unit names even
     when it had its own guard.

fix: |
  Applied `conversion_rate > 1` guards across all affected locations:

  1. qmhq/[id]/page.tsx (line 933): Added `(item as any).conversion_rate > 1` guard before showing
     standard unit secondary line in Requested Items table. Also fixed calculation to multiply quantity
     by conversion_rate (was incorrectly showing base quantity with decimals instead of converted qty).

  2. qmhq/[id]/page.tsx (line 542): In itemsProgressData useMemo, only set standardUnitName when
     itemConversionRate > 1. This prevents "Atom" from appearing in the Items Summary Progress component.

  3. inventory/stock-out-requests/[id]/page.tsx (line 378, 396, 430): All three unit_name source
     assignments now clear unit_name to undefined when conversion_rate <= 1. This fixes line items,
     warehouse assignments, and pending L1 approval displays.

  4. inventory/stock-out-requests/[id]/page.tsx (line 1111): Added `lineItem.conversion_rate > 1`
     guard in Approvals tab standard unit display.

  5. inventory/stock-out-requests/[id]/page.tsx (line 1227): Added `(tx.conversion_rate ?? 1) > 1`
     guard in Transactions tab standard unit display.

  6. components/ui/standard-unit-display.tsx: Fixed primary quantity formatter to use 0 decimal places
     (integers). Added `conversionRate > 1` guard for the secondary standard unit line.

  7. app/(dashboard)/warehouse/[id]/page.tsx: Added `has_standard_conversion` field to
     WarehouseInventoryItem interface. Updated data building to set it true when any transaction has
     conversion_rate > 1. Used it as guard for standard stock display. Also added `conversionRate > 1`
     guard in the transactions column renderer.

  8. app/(dashboard)/inventory/page.tsx (line 512): Added `transaction.conversion_rate > 1` guard.

  9. app/(dashboard)/invoice/new/page.tsx: Changed guard from `> 0` to `> 1` and added unit_name check.

  10. components/po/po-line-items-table.tsx: Changed guard from `> 0` to `> 1` and added item_standard_unit check.

verification: |
  - TypeScript type check: EXIT CODE 0 (no errors)
  - ESLint: Only pre-existing warnings, no new errors from changes
  - All `conversion_rate > 1` guards verified via grep across all changed files
  - Standard unit display component now shows primary qty as integer (0 decimal places) and
    only shows secondary line when conversionRate > 1

files_changed:
  - app/(dashboard)/qmhq/[id]/page.tsx
  - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  - app/(dashboard)/warehouse/[id]/page.tsx
  - app/(dashboard)/inventory/page.tsx
  - app/(dashboard)/invoice/new/page.tsx
  - components/qmhq/items-summary-progress.tsx (no changes needed — data source fixed)
  - components/ui/standard-unit-display.tsx
  - components/po/po-line-items-table.tsx
