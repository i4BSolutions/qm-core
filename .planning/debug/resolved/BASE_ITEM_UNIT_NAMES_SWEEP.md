---
status: resolved
trigger: "base-item-unit-names-system-wide"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — 2 PDF documents render unit_name without conversion_rate > 1 guard
test: Verified by reading full file content
expecting: Fix lib/pdf/documents/stock-out-pdf.tsx and lib/pdf/documents/invoice-pdf.tsx
next_action: Apply fixes to both PDF files

## Symptoms

expected: Base items (conversion_rate = 1 or no standard unit) should NEVER show a unit name. Only items with a real standard unit conversion (conversion_rate > 1) should display unit names.
actual: Unit names like "Atom" or "pcs" still appear for base items in various places throughout the system.
errors: No errors — display issue
reproduction: Navigate through the system looking at any item quantities — base items still show unit names in places that were missed by the previous fix.
started: Still present after commit 54b7eb4 which fixed 7 files

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:05:00Z
  checked: StandardUnitDisplay component
  found: Already has the guard — `showSecondLine = unitName && unitName.trim() !== "" && conversionRate > 1`
  implication: Any usage of StandardUnitDisplay is safe — it handles the guard internally

- timestamp: 2026-02-18T00:05:00Z
  checked: stock-out-requests components (l1-approval-dialog, l2-warehouse-dialog, warehouse-assignments-tab, line-item-table)
  found: All four already use `unit_name && conversion_rate > 1` guards before displaying unit names
  implication: These are already fixed

- timestamp: 2026-02-18T00:05:00Z
  checked: invoice/invoice-line-items-table.tsx ReadonlyInvoiceLineItemsTable
  found: Uses StandardUnitDisplay — which is already guarded. Safe.
  implication: No fix needed here

- timestamp: 2026-02-18T00:06:00Z
  checked: lib/pdf/documents/stock-out-pdf.tsx
  found: BUG — Lines 103, 120, 130, 140: `const unitName = item.unit_name || ''` then checks `{unitName && ...}` — this only checks truthy string, NOT conversion_rate > 1. A base item with unit_name "Atom" and conversion_rate=1 would pass this check and render the converted quantity + unit_name.
  implication: PDF exports for stock-out requests show unit names for base items

- timestamp: 2026-02-18T00:06:00Z
  checked: lib/pdf/documents/stock-out-pdf.tsx approvals section
  found: BUG — Line 268: `{approval.unit_name && approval.conversion_rate && ...}` — checks conversion_rate is truthy (not > 1). If conversion_rate = 1 (base item), this is truthy and shows the unit name.
  implication: Approvals section of stock-out PDF also shows unit names for base items

- timestamp: 2026-02-18T00:06:00Z
  checked: lib/pdf/documents/invoice-pdf.tsx
  found: BUG — Lines 228-232: `{li.unit_name && (<Text>...{li.unit_name}</Text>)}` — only checks if unit_name exists, not conversion_rate > 1. Also the "Std Qty" column always shows the computed value even when conversion_rate=1 (it just shows the same number, which might be OK, but the unit_name label is wrong).
  implication: Invoice PDF shows unit name for base items

- timestamp: 2026-02-18T00:06:00Z
  checked: app/(dashboard)/item/page.tsx
  found: Displays `item.standard_unit_rel?.name` in the "Unit" column — this is just showing what unit the item IS, not a conversion display. This is contextually correct (the item detail admin list shows the standard unit type).
  implication: No fix needed — it's an admin data display showing unit type, not a quantity conversion

- timestamp: 2026-02-18T00:06:00Z
  checked: app/(dashboard)/item/[id]/page.tsx
  found: Lines 418-422 and 572: Shows `item.standard_unit_rel.name` in item detail. Same as above — showing item metadata, not quantity conversion.
  implication: No fix needed — these are item attribute displays, not quantity conversion displays

- timestamp: 2026-02-18T00:07:00Z
  checked: app/(dashboard)/po/new/page.tsx
  found: The item_standard_unit field is in LineItemFormData but never rendered in the UI directly in a problematic way
  implication: No fix needed

- timestamp: 2026-02-18T00:07:00Z
  checked: app/(dashboard)/po/[id]/page.tsx
  found: unit_name is fetched and mapped but display is delegated to ReadonlyLineItemsTable (po-line-items-table) which was already fixed (previous commit 54b7eb4)
  implication: No fix needed here

## Resolution

root_cause: Two PDF document components (stock-out-pdf.tsx and invoice-pdf.tsx) rendered unit names without checking conversion_rate > 1. stock-out-pdf.tsx used `const unitName = item.unit_name || ''` then `{unitName && ...}` (only truthy string check, not rate check), plus the approvals section checked `approval.conversion_rate` for truthiness (1 is truthy). invoice-pdf.tsx used `{li.unit_name && ...}` with no rate check at all.

fix: |
  1. lib/pdf/documents/stock-out-pdf.tsx line 104: Changed unitName assignment to:
     `const unitName = (item.unit_name && conversionRate > 1) ? item.unit_name : '';`
     This makes the existing downstream `{unitName && ...}` checks correct.
  2. lib/pdf/documents/stock-out-pdf.tsx line 269: Added `&& approval.conversion_rate > 1` to the approvals section guard.
  3. lib/pdf/documents/invoice-pdf.tsx line 228: Changed `{li.unit_name && ...}` to `{li.unit_name && (li.conversion_rate ?? 1) > 1 && ...}`.

verification: |
  - All other files (l1-approval-dialog, l2-warehouse-dialog, warehouse-assignments-tab, line-item-table) already had correct `conversion_rate > 1` guards.
  - StandardUnitDisplay component was already guarded internally.
  - ReadonlyInvoiceLineItemsTable uses StandardUnitDisplay — already safe.
  - item/page.tsx and item/[id]/page.tsx display unit as item METADATA (not quantity conversion) — correct behavior, no fix needed.
  - po/[id]/page.tsx uses ReadonlyLineItemsTable from po-line-items-table — already fixed in previous commit.

files_changed:
  - lib/pdf/documents/stock-out-pdf.tsx
  - lib/pdf/documents/invoice-pdf.tsx
