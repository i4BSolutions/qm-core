---
status: resolved
trigger: "base-item-unit-text-everywhere — EXHAUSTIVE third attempt to eliminate unit text for base items"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — multiple places show unit text for all items without checking conversion_rate > 1
test: Exhaustive grep completed, reading rendering code at each site
expecting: All issues found, now applying fixes
next_action: Apply fixes to all identified locations

## Symptoms

expected: Base items (conversion_rate <= 1 or no standard unit) show ONLY the raw number — e.g. "500" with NO text suffix
actual: Unit names/labels (box, pcs, Atom, or any unit name) still appear after quantities for base items on multiple pages
errors: No errors — purely a display issue
reproduction: Navigate QMHQ, SOR, PO, Invoice, Inventory, Warehouse, Item pages — base items show unit text after quantities
started: Persisting after two fix rounds (commits 54b7eb4 and 66e0f2b)

## Eliminated

- hypothesis: SOR approval dialogs (l1-approval-dialog, l2-warehouse-dialog) show unconditional unit text
  evidence: Both guard with `lineItem.unit_name && lineItem.conversion_rate > 1`. The unit_name is already stripped at SOR page level for base items (line 378 of stock-out-requests/[id]/page.tsx)
  timestamp: 2026-02-18

- hypothesis: StandardUnitDisplay component shows unit for base items
  evidence: Component guards with `conversionRate > 1` internally at line 70. Safe.
  timestamp: 2026-02-18

- hypothesis: ReadonlyInvoiceLineItemsTable and ReadonlyLineItemsTable (PO) show unit for base items
  evidence: Both use StandardUnitDisplay which guards internally. Safe if conversion_rate passed correctly.
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: qmhq/[id]/page.tsx lines 929-931
  found: `{item.item?.default_unit && <span>{item.item.default_unit}</span>}` — shows default_unit (e.g. 'pcs', 'box') unconditionally after quantity for ALL items in QMHQ requested items list
  implication: 'pcs', 'box', or any default_unit value shows for base items. No conversion_rate guard here at all.

- timestamp: 2026-02-18
  checked: item/[id]/page.tsx lines 221, 460 — `formatStockQuantity(qty, item.default_unit)`
  found: `formatStockQuantity` appends unit name if truthy. `item.default_unit` defaults to 'pcs' in DB for ALL items.
  implication: All items in item detail page show 'pcs' (or whatever default_unit is) next to their stock quantity. No conversion_rate guard.

- timestamp: 2026-02-18
  checked: lib/utils/inventory.ts `formatStockQuantity` function
  found: `return unit ? \`${formattedQty} ${unit}\` : formattedQty;` — appends unit unconditionally if not null/undefined
  implication: This utility function cannot distinguish base items from converted items — the caller must pass `null` for base items.

- timestamp: 2026-02-18
  checked: item/[id]/page.tsx — item data fetch
  found: Item fetched has `default_unit` from DB (defaults to 'pcs') and `standard_unit_rel` but NO `conversion_rate` on the item record itself. Conversion rate lives on transactions/line items.
  implication: For item detail page specifically, we cannot check conversion_rate from item alone. default_unit is a separate concept from standard_unit. The user wants quantities shown as raw numbers only (no unit text) for base items.

- timestamp: 2026-02-18
  checked: invoice/new/page.tsx line 112
  found: `unit_name: (poLineItem.item as any)?.standard_unit_rel?.name || undefined` — NO conversion_rate guard. Sets unit_name for ALL items.
  implication: When the user-entered conversion_rate is "1" or "" (initial state), StandardUnitDisplay guards it. The display at line 700-707 DOES guard with parseFloat(conversion_rate) > 1. So this is actually SAFE for display.

- timestamp: 2026-02-18
  checked: item/[id]/page.tsx line 418-422 and 572
  found: Shows `Unit: {item.standard_unit_rel.name}` and `{item.standard_unit_rel?.name || "—"}` in item metadata panel
  implication: This is ITEM METADATA display (what unit the item uses), not quantity display. Showing the standard unit name in the item info panel is appropriate for all items (even base ones show their "Atom" unit name in info). Context is ambiguous — these are informational fields, not quantity suffix.

- timestamp: 2026-02-18
  checked: item/page.tsx line 434 — `{item.standard_unit_rel?.name || "—"}`
  found: Shows standard unit name in the Unit column of item list table
  implication: Same as above — informational column, not quantity suffix. Appropriate to show.

## Resolution

root_cause: |
  Multiple files showed unit text (from default_unit, item_unit, and unit_name fields) next to
  quantities without checking conversion_rate > 1. Root causes by category:

  1. qmhq/[id]/page.tsx line 929: showed `item.item?.default_unit` ("pcs", "box") next to
     QMHQ requested item quantities with NO conversion_rate guard.

  2. item/[id]/page.tsx lines 221, 460: called `formatStockQuantity(qty, item.default_unit)`
     which appended default_unit ("pcs" etc.) to all stock quantities. The items table has no
     conversion_rate column — the rate lives on transactions. Fix: remove default_unit from calls.

  3. warehouse/[id]/page.tsx line 287: called `formatStockQuantity(stock, unit)` (item_unit =
     default_unit) without checking has_standard_conversion. Fix: pass unit only when
     has_standard_conversion is true.

  4. invoice-po-selector.tsx line 255: showed item_unit next to PO quantity with NO
     conversion_rate guard. Fix: guard with (item.conversion_rate ?? 1) > 1.

  5. invoice-line-items-table.tsx line 124: showed item_unit next to available_quantity in
     editable invoice table with NO guard. Fix: guard with parseFloat(item.conversion_rate) > 1.

  6. invoice/new/page.tsx line 654: showed "Unit: {item_unit}" label with NO guard. Fix: guard.

  7. stock-in/page.tsx lines 848, 977: showed "Unit: {item_unit}" labels with NO guard. Fix: guard.

  8. po-matching-tab.tsx line 91: showed unit next to ordered qty with NO conversion_rate guard.
     Fix: added conversionRate to MatchingLineItem, guard display.

  9. l2-warehouse-dialog.tsx line 461: showed "(boxes to {unit_name})" with only unit_name truthy
     check, not conversion_rate > 1. Fixed with explicit guard.

fix: |
  Added conversion_rate > 1 guards to all unit text displays. For item detail and warehouse
  pages where conversion_rate is not available at item level, removed the default_unit entirely
  from quantity displays (quantities are self-explanatory without unit suffix).

verification: |
  TypeScript type-check passes (tsc --noEmit) with zero errors.
  ESLint shows only pre-existing warnings, no new issues.

files_changed:
  - app/(dashboard)/qmhq/[id]/page.tsx
  - app/(dashboard)/item/[id]/page.tsx
  - app/(dashboard)/warehouse/[id]/page.tsx
  - app/(dashboard)/inventory/stock-in/page.tsx
  - app/(dashboard)/invoice/new/page.tsx
  - components/invoice/invoice-po-selector.tsx
  - components/invoice/invoice-line-items-table.tsx
  - components/po/po-matching-tab.tsx
  - components/stock-out-requests/l2-warehouse-dialog.tsx
