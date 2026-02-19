---
status: resolved
trigger: "standard-qty-not-showing"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:30:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED - CategoryItemSelector did not fetch standard_unit_rel; SOR create and stock-in pages never received standard unit data
test: TypeScript check (no errors), lint check (no new errors)
expecting: standard unit name shows in dropdown items and inline after conversion rate entry
next_action: COMPLETE

## Symptoms

expected: standard_qty and standard unit name shown inline alongside items everywhere in the system (same visual pattern as EUSD)
actual: standard_qty and standard unit name not showing in SOR create form and likely missing across all item displays
errors: none - purely a missing display issue
reproduction: go to SOR create form, select item - standard qty and unit are not visible
started: likely never implemented - standard unit system added in v1.11 (phases 48-54) but display not propagated

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-19T00:10:00Z
  checked: CategoryItemSelector query
  found: SELECT id, name, sku, default_unit, price_reference FROM items - no standard_unit_rel
  implication: ItemOption type has no standard unit field, so onItemSelect can never return unit name

- timestamp: 2026-02-19T00:11:00Z
  checked: SOR create page LineItem interface
  found: {id, categoryId, itemId, itemName, itemSku, quantity, conversionRate} - no standardUnit field
  implication: even if selector returned unit name, no place to store it

- timestamp: 2026-02-19T00:12:00Z
  checked: SOR create page item display (lines 620-667)
  found: shows SKU and name only; has ConversionRateInput but no standard unit inline display
  implication: "= N.NN unit" pattern never rendered

- timestamp: 2026-02-19T00:13:00Z
  checked: PO line items table (po-line-items-table.tsx lines 272-282)
  found: shows "= {qty * rate} {item_standard_unit}" when conversion_rate != 1, rate > 0, qty > 0, item_standard_unit present
  implication: this is the target pattern to replicate

- timestamp: 2026-02-19T00:14:00Z
  checked: SOR detail page (stock-out-requests/[id]/page.tsx)
  found: already queries standard_unit_rel, maps to unit_name on LineItemWithApprovals
  implication: SOR detail already works; create page is the gap

- timestamp: 2026-02-19T00:15:00Z
  checked: Invoice new page
  found: already handles unit_name from PO line items' standard_unit_rel; shows inline "= N.NN unit" at lines 700-709
  implication: invoice create already works

- timestamp: 2026-02-19T00:16:00Z
  checked: PO new page
  found: fetches items WITH standard_unit_rel:standard_units!items_standard_unit_id_fkey(name); EditableLineItemsTable sets item_standard_unit; shows inline at lines 272-282
  implication: PO create already works

- timestamp: 2026-02-19T00:17:00Z
  checked: PO detail page (po/[id]/page.tsx)
  found: queries standard_unit_rel, maps unit_name; ReadonlyLineItemsTable receives it
  implication: need to check ReadonlyLineItemsTable rendering

- timestamp: 2026-02-19T00:18:00Z
  checked: QMHQ detail page item section (line 933-935)
  found: shows inline "N.NN unit" when standard_unit_rel present and conversion_rate != 1
  implication: QMHQ detail already works

- timestamp: 2026-02-19T00:19:00Z
  checked: Item list page (/item/page.tsx)
  found: fetches standard_unit_rel for display; need to check rendering section
  implication: need to check if standard_unit is displayed in the item list table

## Resolution

root_cause: CategoryItemSelector did not fetch standard_unit_rel from items table. ItemOption type had no standard_unit_name field. SOR create page LineItem interface had no standardUnit field, and the conversion rate section had no inline "= N.NN unit" display. Stock-in manual mode had the same gap (no standard unit capture or display). All other locations (PO create/detail, invoice create/detail, QMHQ new/detail, item list/detail, SOR detail) already handled standard units correctly.

fix: |
  1. CategoryItemSelector (components/forms/category-item-selector.tsx):
     - Added standard_unit_name to ItemOption interface
     - Extended query to include standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)
     - Maps standard_unit_rel.name to flat standard_unit_name field
     - Shows unit name in dropdown list as right-aligned hint text

  2. SOR create (app/(dashboard)/inventory/stock-out-requests/new/page.tsx):
     - Added standardUnit field to LineItem interface
     - Updated initial state and QMHQ pre-fill to include standardUnit: ""
     - Updated onItemSelect callback to capture standard_unit_name
     - Added inline "= N.NN unit" display below conversion rate when
       conversion_rate != 1 and qty > 0 and standardUnit is known;
       otherwise shows "To standard unit (unitName)" hint

  3. Stock-In manual mode (app/(dashboard)/inventory/stock-in/page.tsx):
     - Added manualStandardUnit state
     - Updated CategoryItemSelector to use onItemSelect to capture standard_unit_name
     - Clears manualStandardUnit on category change
     - Added same inline "= N.NN unit" display below conversion rate

verification: TypeScript check passed (no errors). ESLint clean (no new warnings).
files_changed:
  - components/forms/category-item-selector.tsx
  - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
  - app/(dashboard)/inventory/stock-in/page.tsx
