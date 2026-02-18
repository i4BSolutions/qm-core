---
status: resolved
trigger: "warehouse-inventory-column-alignment - In the warehouse detail page (/warehouse/[id]), the 'Current Inventory' table columns are not aligning with their values."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - TableHead uses text-left by default, but numeric column cells use text-right; no mechanism to propagate alignment from column definition to the <th> element
test: Read TableHead, DataTable, and column definitions
expecting: Root cause confirmed - header/cell alignment mismatch for Stock, WAC, Total Value columns
next_action: Fix by adding meta className support to DataTable and updating numeric columns

## Symptoms

expected: Table column headers should align properly with the cell values in each row
actual: Column headers and cell values are misaligned - headers don't line up with their corresponding data
errors: No errors - purely a visual/CSS layout issue
reproduction: Go to any warehouse detail page (/warehouse/[id]) and look at the Current Inventory table
started: Likely introduced by stock unit display fix (commit aed8314) or standard unit system milestone

## Eliminated

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: components/ui/table.tsx TableHead definition
  found: TableHead has class "text-left" hardcoded - all <th> elements are left-aligned
  implication: Headers for numeric/right-aligned columns will be left-aligned regardless of cell alignment

- timestamp: 2026-02-18T00:02:00Z
  checked: warehouse/[id]/page.tsx inventoryColumns definitions
  found: "current_stock", "wac_amount_eusd", "total_value_eusd" columns all have cells with "text-right" or right-aligned CurrencyDisplay, but their headers use DataTableColumnHeader which renders a <Button> left-aligned inside the <th>
  implication: These 3 columns show left-aligned headers and right-aligned values = misalignment

- timestamp: 2026-02-18T00:03:00Z
  checked: components/tables/data-table.tsx - how TableHead is rendered
  found: TableHead is rendered without any className from the column definition - no meta support
  implication: Need to add meta.className support to DataTable so column definitions can control <th> alignment

- timestamp: 2026-02-18T00:04:00Z
  checked: DataTableColumnHeader component
  found: Uses -ml-3 on the Button, which is designed for left-aligned headers. For right-aligned headers, the button should not have this negative left margin
  implication: For right-aligned columns, the header button style needs adjustment too

## Resolution

root_cause: TableHead component has "text-left" hardcoded. Numeric columns (Stock, WAC, Total Value) render cells with "text-right" but the DataTable component had no mechanism to propagate alignment from column definitions to the <th> elements. The DataTableColumnHeader button also had a hardcoded "-ml-3" that always pulled the header button left, creating a visible left/right alignment mismatch.

fix: Three-part fix:
1. DataTable: Added meta.className support - now reads (column.columnDef.meta as { className? }).className and applies it to TableHead
2. DataTableColumnHeader: Made the Button's className prop-aware by merging className via cn() so callers can override the negative margin
3. Warehouse page columns: Added meta: { className: "text-right" } and wrapped each header in <div className="flex justify-end"> with className="-ml-0 -mr-3" on the header button to right-align headers for Stock, WAC, and Total Value columns

verification: TypeScript type-check passes (npm run type-check), lint passes with no new errors
files_changed:
  - components/tables/data-table.tsx
  - app/(dashboard)/warehouse/[id]/page.tsx
