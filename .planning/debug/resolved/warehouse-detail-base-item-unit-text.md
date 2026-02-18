---
status: resolved
trigger: "warehouse-detail-base-item-unit-text: Warehouse detail list view still shows 'pcs' unit text for base items when it should be suppressed."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - The `item_unit` column (lines 253-266) renders item.default_unit ("pcs") unconditionally without guarding against base items (has_standard_conversion = false).
test: Read page.tsx to find all unit rendering code
expecting: Fix by guarding item_unit column with has_standard_conversion, matching the pattern used in the Stock column and other pages
next_action: Apply fix to the item_unit column cell renderer

## Symptoms

expected: Base items (conversion_rate <= 1) on the warehouse detail list view should show just the raw quantity (e.g. "500") with no unit name like "pcs". The conversion line "5,000.00 Molique" should also not appear for base items.
actual: The warehouse detail list view displays "500 pcs" and "5,000.00 Molique" for base items — showing unit text that should be suppressed.
errors: No runtime errors — display logic bug.
reproduction: Go to a warehouse detail page, look at the inventory list. Base items (conversion_rate <= 1) show "pcs" unit text and conversion values when they shouldn't.
started: Part of ongoing sweep; recent commits fixed many pages but warehouse detail list view was missed.

## Eliminated

- hypothesis: The Stock column cell's formatStockQuantity call was unguarded
  evidence: ff9acb9 already fixed that - it now passes unit only when has_standard_conversion is true
  timestamp: 2026-02-18

- hypothesis: The conversion line (standard_stock / standard_unit_name) was unguarded
  evidence: Lines 289-293 already guard with `row.original.standard_unit_name && row.original.has_standard_conversion`
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: /app/(dashboard)/warehouse/[id]/page.tsx lines 253-266 (item_unit column)
  found: item_unit column renders row.getValue("item_unit") (= item.default_unit = "pcs") unconditionally with no guard
  implication: This is the source of the "pcs" unit text showing for base items

- timestamp: 2026-02-18
  checked: /app/(dashboard)/warehouse/[id]/page.tsx lines 138-160 (inventoryMap construction)
  found: has_standard_conversion is set to true when any transaction has conversion_rate > 1; stays false for pure base items
  implication: has_standard_conversion correctly identifies base items (false) vs converted items (true)

- timestamp: 2026-02-18
  checked: commit ff9acb9 diff for warehouse/[id]/page.tsx
  found: Previous fix only patched formatStockQuantity call; missed the item_unit column
  implication: The item_unit column is the remaining unguarded location

## Resolution

root_cause: The "Unit" column in the inventory DataTable (item_unit accessorKey) renders item.default_unit unconditionally. For base items (has_standard_conversion = false), this shows "pcs" without any guard. The fix pattern - established in ff9acb9 and other pages - is to suppress unit display when has_standard_conversion is false.
fix: Guard the item_unit column cell to return "—" (or null) when !has_standard_conversion, matching the pattern used throughout the codebase.
verification: ESLint passes with no errors. Visual logic: base items with has_standard_conversion=false now render "—" in the Unit column instead of "pcs". The Stock column was already guarded by ff9acb9. The conversion line (standard_stock Molique) was already guarded by has_standard_conversion. Fix is targeted and minimal - one guard added to one column cell renderer.
files_changed: [app/(dashboard)/warehouse/[id]/page.tsx]
