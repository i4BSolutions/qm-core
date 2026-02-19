---
status: resolved
trigger: "missing-standard-qty-unit-sor-stockin"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:30:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED AND FIXED. Two gaps existed after the previous "standard-qty-not-showing" session. Both are now fixed.
test: TypeScript type-check (0 errors), ESLint (0 new warnings)
expecting: Standard unit name now shows in SOR create QMHQ-linked mode and stock-in invoice mode
next_action: COMPLETE

## Symptoms

expected: When selecting an item in SOR create (from QMHQ item route) and Stock In pages, the item's standard_qty and standard unit name should be displayed so users understand the unit conversion (e.g., "1 Box = 12 Pieces").
actual: The standard_qty and standard unit name fields are missing / not displayed in the SOR create form and Stock In form.
errors: No console errors — this is a missing data display issue, not a crash.
reproduction: 1) Go to create SOR from a QMHQ with item route. 2) Observe that standard_qty and standard unit name are not shown. 3) Go to Stock In page. 4) Same issue — standard_qty and unit name not displayed.
started: The previous fix (standard-qty-not-showing session) fixed manual item selection paths. The QMHQ pre-fill path and invoice mode path were not addressed.

## Eliminated

- hypothesis: CategoryItemSelector does not fetch standard_unit_rel
  evidence: CategoryItemSelector already includes standard_unit_rel in its query (line 177) and maps it to standard_unit_name (line 204). This was fixed in the previous session.
  timestamp: 2026-02-19T00:12:00Z

- hypothesis: SOR create page never uses onItemSelect
  evidence: When manually selecting items (no qmhqId), onItemSelect IS called and captures standard_unit_name (line 667). The gap is ONLY in the QMHQ pre-fill path where CategoryItemSelector is not shown.
  timestamp: 2026-02-19T00:13:00Z

## Evidence

- timestamp: 2026-02-19T00:05:00Z
  checked: CategoryItemSelector (components/forms/category-item-selector.tsx)
  found: Query at line 177 includes standard_unit_rel:standard_units!items_standard_unit_id_fkey(name). Maps to standard_unit_name at line 204. ItemOption interface has standard_unit_name field. Standard unit shown in dropdown item list.
  implication: CategoryItemSelector is already fixed. The issue is in paths that bypass it.

- timestamp: 2026-02-19T00:06:00Z
  checked: SOR create page QMHQ fetch query (stock-out-requests/new/page.tsx lines 117-124)
  found: Query fetched qmhq_items(item_id, quantity, item:items(id, name, sku, category_id)) - NO standard_unit_rel in the items sub-query
  implication: Standard unit name was not available when pre-filling from QMHQ

- timestamp: 2026-02-19T00:07:00Z
  checked: SOR create page QMHQ pre-fill (lines 139-165)
  found: standardUnit hardcoded to "" in both qmhq_items path and legacy item_id path
  implication: Standard unit never populated for QMHQ-linked SOR, so the conversion rate hint never showed

- timestamp: 2026-02-19T00:08:00Z
  checked: SOR create page item display UI when qmhqId is set
  found: When item.itemId is pre-filled (qmhqId set), a locked display div is shown (not CategoryItemSelector). onItemSelect callback is never triggered. standardUnit remained "".
  implication: Even if query returned standard unit, there was no mechanism to populate standardUnit in the pre-fill path without explicit assignment

- timestamp: 2026-02-19T00:09:00Z
  checked: Stock-in page invoice mode interfaces and query
  found: InvoiceLineItemWithItem had item: Pick<Item, "id"|"name"|"sku"|"default_unit"> - no standard_unit_rel. StockInLineItem had no item_standard_unit field. fetchInvoiceLineItems mapped item_unit from default_unit only.
  implication: Invoice-mode stock-in line items had no standard unit info for the conversion rate hint

- timestamp: 2026-02-19T00:10:00Z
  checked: Stock-in page invoice mode line item display
  found: Conv. Rate input showed but no "To standard unit (X)" hint below it, because standard_unit was not in the data model.
  implication: Invoice mode stock-in was missing the standard unit hint entirely

- timestamp: 2026-02-19T00:11:00Z
  checked: Stock-in page manual mode
  found: manualStandardUnit state exists, CategoryItemSelector onItemSelect captures it, inline hint shown below conversion rate
  implication: Manual mode is already fixed. Only invoice mode was broken.

## Resolution

root_cause: |
  Two unfixed paths after the previous fix:
  1. SOR create in QMHQ-linked mode: QMHQ fetch query did not include standard_unit_rel on items, and pre-fill hardcoded standardUnit:"". Item is shown locked (not via CategoryItemSelector), so onItemSelect never fired.
  2. Stock-in in invoice mode: InvoiceLineItemWithItem fetched item.default_unit but not standard_unit_rel. StockInLineItem had no item_standard_unit field. No hint was shown below conversion rate for invoice-mode lines.

fix: |
  1. SOR create (app/(dashboard)/inventory/stock-out-requests/new/page.tsx):
     - Added standard_unit_rel field to QMHQData item interfaces (both top-level item and qmhq_items.item)
     - Extended QMHQ fetch query: added standard_unit_rel:standard_units!items_standard_unit_id_fkey(name) to both item sub-queries
     - Cast data to unknown as QMHQData before pre-fill (TypeScript can't resolve nested join foreign key alias)
     - In pre-fill, read qmhqItem.item.standard_unit_rel?.name and populate standardUnit field

  2. Stock-in invoice mode (app/(dashboard)/inventory/stock-in/page.tsx):
     - Extended InvoiceLineItemWithItem item type with standard_unit_rel field
     - Added item_standard_unit field to StockInLineItem interface
     - Extended fetchInvoiceLineItems query with standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)
     - In mapping, cast item to include standard_unit_rel, propagate .name to item_standard_unit
     - Added "= N.NN unit" hint below Conv. Rate input when conversion_rate != 1 and qty > 0 and unit name available
     - Added "-> unit" static hint when unit name known but no conversion rate entered yet

verification: TypeScript type-check 0 errors. ESLint 0 new warnings.
files_changed:
  - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
  - app/(dashboard)/inventory/stock-in/page.tsx
