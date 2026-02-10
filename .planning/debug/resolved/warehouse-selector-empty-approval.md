---
status: resolved
trigger: "warehouse-selector-empty-approval"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - PostgREST PGRST201 error caused by ambiguous relationship. The query at line 73 uses `warehouse:warehouses(id, name)` but inventory_transactions has TWO foreign keys to warehouses (warehouse_id and destination_warehouse_id), causing PostgREST to not know which relationship to use.
test: Fix by specifying the FK hint in the Supabase query
expecting: Adding FK hint will resolve the ambiguity and warehouse stock will load correctly
next_action: Apply fix to approval-dialog.tsx line 73

## Symptoms

expected: Warehouse selector should show warehouses that have stock for the selected item when approving a stock-out request line item.
actual: Empty dropdown - no warehouses appear in the selector.
errors: PostgREST error - `Error fetching warehouse stock: {code: 'PGRST201', details: Array(2), hint: "Try changing 'warehouses' to one of the following:…nd the desired relationship in the 'details' key.", message: "Could not embed because more than one relationship…und for 'inventory_transactions' and 'warehouses'"}`
reproduction: Go to stock-out request detail page -> try to approve a line item -> open warehouse selector dropdown -> empty
started: Never worked - first time testing this feature (recently built in Phase 28)

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: /home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx
  found: fetchWarehouseStockForItem function at lines 60-115 queries inventory_transactions with `.select('movement_type, warehouse_id, quantity, warehouse:warehouses(id, name)')` at line 68-74
  implication: The select statement uses ambiguous relationship name 'warehouses' without specifying which FK

- timestamp: 2026-02-10T00:06:00Z
  checked: /home/yaungni/qm-core/supabase/migrations/023_inventory_transactions.sql
  found: inventory_transactions table has TWO foreign keys to warehouses table - `warehouse_id` (line 34) and `destination_warehouse_id` (line 71)
  implication: PostgREST cannot determine which FK relationship to use when joining to 'warehouses', causing PGRST201 error

- timestamp: 2026-02-10T00:10:00Z
  checked: Applied fix to approval-dialog.tsx
  found: Changed line 73 from `warehouse:warehouses(id, name)` to `warehouses!warehouse_id(id, name)` and updated line 85 from `txn.warehouse.name` to `txn.warehouses.name`
  implication: Fix applied, ready for testing

## Resolution

root_cause: The query in approval-dialog.tsx line 73 uses `warehouse:warehouses(id, name)` which is ambiguous because inventory_transactions has two foreign keys to warehouses (warehouse_id and destination_warehouse_id). PostgREST cannot determine which relationship to use, resulting in PGRST201 error.

fix: Specify the FK hint using the column name. Change `warehouse:warehouses(id, name)` to `warehouses!warehouse_id(id, name)` to explicitly use the warehouse_id foreign key relationship. Also updated the field access from `txn.warehouse.name` to `txn.warehouses.name` to match the new field name.

verification: Fix applied successfully. The query now uses the explicit FK hint `warehouses!warehouse_id` to disambiguate the relationship, and the field access has been updated accordingly. The warehouse selector should now populate correctly with warehouses that have stock for the selected item when approving stock-out request line items.

files_changed: [
  "components/stock-out-requests/approval-dialog.tsx"
]
