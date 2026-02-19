---
status: resolved
trigger: "sor-l1-approval-warehouse-restriction"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED — The Postgres trigger function `validate_sor_approval()` (applied in `20260217100000_two_layer_approval_schema.sql`) contains a stock availability check at L1 that raises an EXCEPTION when `NEW.approved_quantity > get_total_item_stock(li_item_id)`. This blocks the INSERT into `stock_out_approvals`, which is the backend enforcement of the restriction seen in the UI.
test: N/A — confirmed via reading migration SQL
expecting: Fix by creating a new migration that removes the stock check from L1 validation and adds an informational warning at UI level instead.
next_action: Create migration to remove L1 stock check from `validate_sor_approval()`; optionally add UI warning in L1ApprovalDialog

## Symptoms

expected: L1 approval should always be allowed regardless of warehouse stock. Show a warning/notice that item is not in warehouse, but do NOT block or disable the approve button.
actual: L1 approval is checking warehouse item quantity and restricting/blocking approval when stock is insufficient.
errors: No error messages — it's a behavior restriction that shouldn't be there at L1 level.
reproduction: Open a Stock-Out Request, try to L1 approve a line item that has no stock in any warehouse.
started: Since L1 approval was implemented in Phase 57.

## Eliminated

- hypothesis: UI button disabled by warehouse stock check in l1-approval-dialog.tsx
  evidence: L1ApprovalDialog has no stock query; the approve button is only disabled while `isSubmitting` is true. The restriction is entirely in the database trigger.
  timestamp: 2026-02-19T00:01:00Z

## Evidence

- timestamp: 2026-02-19T00:00:30Z
  checked: components/stock-out-requests/l1-approval-dialog.tsx
  found: No warehouse stock check present. The dialog only validates qty > 0 and qty <= remaining_quantity. The approve button has no stock-related disable condition.
  implication: Restriction is not in the UI dialog.

- timestamp: 2026-02-19T00:00:45Z
  checked: components/stock-out-requests/line-item-table.tsx
  found: Approve Qty button shown only when `canApprove && item.status === 'pending'`. No stock check.
  implication: Restriction is not in the line item table component.

- timestamp: 2026-02-19T00:01:00Z
  checked: supabase/migrations/20260217100000_two_layer_approval_schema.sql lines 190-196
  found: The `validate_sor_approval()` Postgres trigger function contains this code in the L1 (quartermaster) branch:
    ```sql
    -- Validate total stock availability across all warehouses
    available_stock := get_total_item_stock(li_item_id);
    IF NEW.approved_quantity > available_stock THEN
      RAISE EXCEPTION 'L1 approved quantity (%) exceeds available stock across all warehouses (%)',
        NEW.approved_quantity, available_stock;
    END IF;
    ```
    This raises a database exception on every L1 approval insert when stock is insufficient, causing the Supabase client to return an error, which the dialog shows as a toast.error.
  implication: ROOT CAUSE FOUND — the DB trigger is the sole mechanism blocking L1 approval.

## Resolution

root_cause: The Postgres trigger function `validate_sor_approval()` (created in migration 20260217100000_two_layer_approval_schema.sql) validates warehouse stock availability at L1 (quartermaster) approval time and raises an EXCEPTION when `approved_quantity > get_total_item_stock(item_id)`. This was incorrect design — L1 should only approve quantity (capped at requested_quantity), not care about current stock levels. Stock availability only matters at L2 (warehouse assignment).
fix: Created migration `20260219000000_remove_l1_stock_check.sql` that rewrites `validate_sor_approval()` using `CREATE OR REPLACE`. The L1 branch now only validates: (1) warehouse_id must be NULL, (2) approved qty + existing L1 total must not exceed requested_qty. The stock availability check and advisory lock that previously blocked L1 are removed. L2 validation is unchanged. Updated `l1-approval-dialog.tsx` to fetch total stock informationally and show an amber warning banner when stock is below requested qty — the approve button remains enabled.
verification: TypeScript type-check passes with no errors. After deploying migration, L1 approval on zero-stock items will succeed; the dialog will show a warning notice but approval is not blocked.
files_changed:
  - supabase/migrations/20260219000000_remove_l1_stock_check.sql (new — removes L1 stock check from DB trigger)
  - components/stock-out-requests/l1-approval-dialog.tsx (updated — adds informational stock warning UI)
