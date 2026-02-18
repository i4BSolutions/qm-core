---
status: resolved
trigger: "warehouse-stock-base-unit-display"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - formatStockQuantity is called with the item_unit (base unit name) argument when has_standard_conversion is true, which causes the unit name to be appended to the numeric quantity in the stock column display
test: Read warehouse detail page and inventory utility files
expecting: Root cause identified in JSX rendering on line 291 of warehouse/[id]/page.tsx
next_action: Apply fix by removing the unit argument from the formatStockQuantity call in the stock column cell renderer

## Symptoms

expected: Stock column should show only the numeric quantity (e.g., "500", "5,000.00") without any unit name suffix
actual: Stock column displays "500 pcs" and "5,000.00 Molique" — the base unit name is appended after the quantity
errors: No errors — it's a UI display issue
reproduction: Go to any warehouse detail page (/warehouse/[id]) and look at the Current Inventory table's stock column
started: Likely introduced during the standard unit system milestone (v1.11)

## Eliminated

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: app/(dashboard)/warehouse/[id]/page.tsx line 291
  found: formatStockQuantity(stock, row.original.has_standard_conversion ? unit : undefined) — passes item_unit (base unit name like "pcs" or "Molique") as second argument when has_standard_conversion is true
  implication: This causes the unit name to be appended to the quantity display in the stock column

- timestamp: 2026-02-18T00:01:00Z
  checked: lib/utils/inventory.ts line 163
  found: formatStockQuantity returns `${formattedQty} ${unit}` when a unit is provided
  implication: Confirmed — passing the unit argument is the direct cause of the "500 pcs" / "5,000.00 Molique" display

## Resolution

root_cause: In the warehouse detail page stock column renderer (line 291), formatStockQuantity is called with the base unit name (item_unit) as the second argument when has_standard_conversion is true. The formatStockQuantity utility appends the unit string to the numeric quantity, producing e.g. "500 pcs". The fix is to never pass the unit to formatStockQuantity in the stock column — show only the numeric quantity.
fix: Remove the unit argument from the formatStockQuantity call in the stock column cell renderer, changing formatStockQuantity(stock, row.original.has_standard_conversion ? unit : undefined) to formatStockQuantity(stock)
verification: Lint passes with no errors. The formatStockQuantity call no longer receives a unit argument, so the stock column will display only the numeric quantity (e.g. "500", "5,000.00") without any unit suffix. The secondary row showing the standard unit quantity (e.g. "5,000.00 Molique") is intentionally preserved as a sub-line for items with standard unit conversions.
files_changed:
  - app/(dashboard)/warehouse/[id]/page.tsx
