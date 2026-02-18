---
status: resolved
trigger: "QMHQ item route's line item selection UI should match the PO line item picker layout, but currently uses a different UI pattern. It should be the same as PO line item choosing, minus the unit price field."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:01:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED - The QMHQ item route uses a simple flat grid with a basic Select dropdown for item selection, while PO uses the rich EditableLineItemsTable component with CategoryItemSelector, +/- qty buttons, conv. rate input, inline item creation, and a subtotal row. The fix is to replace the QMHQ item section with a UI matching the PO line items table but without the unit price field.
test: COMPLETED
expecting: n/a - root cause confirmed
next_action: Rewrite the item route section in /app/(dashboard)/qmhq/new/[route]/page.tsx to use the same PO-style picker pattern (CategoryItemSelector + qty stepper + conv. rate + subtotal), minus unit price

## Symptoms

expected: When creating a QMHQ with item route, the line item selection/adding experience should use the same UI layout and pattern as the PO line item picker. Everything the PO line item picker has should carry over EXCEPT the unit price field (not needed for QMHQ items).
actual: The QMHQ item route's line item selection uses a different UI layout/pattern than the PO line item picker.
errors: No runtime errors — this is a UI consistency issue.
reproduction: Compare creating a PO (adding line items at /po/new) vs creating a QMHQ item route (adding line items at /qmhq/new).
started: Has always been different UIs. User wants them aligned now.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: /app/(dashboard)/qmhq/new/[route]/page.tsx — item route section (lines 469–564)
  found: Uses a simple grid layout with: row number, basic Select dropdown (flat list of items, no category filter), plain text quantity Input, and a Trash2 delete button. Item state type is {id, item_id, quantity (string)}.
  implication: Missing CategoryItemSelector, +/- qty stepper buttons, conversion rate input, item name/SKU display after selection, "Change" button, "Create new item" (+) button, and subtotal row.

- timestamp: 2026-02-18T00:01:00Z
  checked: /components/po/po-line-items-table.tsx — EditableLineItemsTable component
  found: Each row has two sub-rows: (1) CategoryItemSelector with "Change" button and "+Create new item" button, delete button. (2) Qty stepper (+/- buttons with numeric input), Unit Price, Conv. Rate, standard unit display, and Line Total. Has subtotal row and "Add Line Item" button. Uses ItemDialog for inline creation.
  implication: This is the target UI pattern. QMHQ item route needs to match this minus the Unit Price field and Line Total display.

- timestamp: 2026-02-18T00:01:00Z
  checked: /supabase/migrations/20260218100000_fix_missing_conversion_rate_columns.sql
  found: qmhq_items table has conversion_rate column (added via migration, NOT NULL, CHECK > 0).
  implication: The DB already supports conversion_rate for qmhq_items. The UI just needs to expose it. The insert in handleSubmit also needs to include conversion_rate.

- timestamp: 2026-02-18T00:01:00Z
  checked: SelectedItem type and fetchRouteData in QMHQ route page
  found: SelectedItem = {id, item_id, quantity (string)}. fetchRouteData fetches items without standard_unit_rel join and without category filtering.
  implication: SelectedItem needs expansion to match LineItemFormData pattern (add category_id, item_name, item_sku, item_unit, item_price_reference, item_standard_unit, conversion_rate). fetchRouteData needs standard_unit_rel join. handleSubmit needs to pass conversion_rate to DB insert.

## Resolution

root_cause: The QMHQ item route line picker was built as a simple dropdown + text input grid, independently of the richer EditableLineItemsTable used by PO. They share no code and have significant UI/UX differences: no category-first search, no qty stepper, no conversion rate, no item creation inline, no subtotal.
fix: Replace the QMHQ item route UI section with a custom inline implementation that mirrors EditableLineItemsTable but omits unit_price and line total. Expand SelectedItem state to include all required fields. Update fetchRouteData to fetch standard_unit_rel. Update handleSubmit to pass conversion_rate.
verification: TypeScript and ESLint both pass cleanly with zero errors/warnings. Implementation mirrors EditableLineItemsTable from po-line-items-table.tsx: CategoryItemSelector (category-first search), item name/SKU badge with Change button, inline item creation dialog (+button), qty stepper (+/- buttons with numeric input), conv. rate input with standard unit display. No unit price field. Subtotal row shows item count. conversion_rate stored correctly to DB.
files_changed:
  - /home/yaungni/qm-core/app/(dashboard)/qmhq/new/[route]/page.tsx
