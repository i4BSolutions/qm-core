---
status: resolved
trigger: "After L1/L2/L3 approval implementation in SOR (Stock Out Request), the QMHQ item detail page no longer shows line item details, summary, or progress bar. Two Supabase API calls return 400 Bad Request."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — commit f33d553 (feat(50-04)) added conversion_rate to qmhq_items and stock_out_approvals queries in the frontend, but migration 20260214200000_standard_unit_columns.sql only added conversion_rate to inventory_transactions and stock_out_line_items, NOT to qmhq_items or stock_out_approvals. PostgREST returns 400 when a query explicitly names a non-existent column.
test: Verified by reading 035_qmhq_items.sql (no conversion_rate column), 052_stock_out_requests.sql (no conversion_rate column), and 20260214200000_standard_unit_columns.sql (only adds to po_line_items, invoice_line_items, inventory_transactions, stock_out_line_items)
expecting: Fix requires two new migration files adding conversion_rate to qmhq_items and stock_out_approvals, or removing the erroneous column references from the frontend queries
next_action: Apply the fix — add missing migration columns for qmhq_items and stock_out_approvals

## Symptoms

expected: QMHQ item detail page shows line items table, summary section, and progress bar
actual: Line items, summary, and progress bar are missing/empty on the QMHQ item detail page
errors:
  1. GET qmhq_items?select=*,conv...warehouses(id,name)&qmhq_id=eq.{uuid} → 400 Bad Request
  2. GET inventory_transactions?select=...&movement_type=eq.inventory_out&is_active=eq.true → 400 Bad Request
reproduction: Open any QMHQ item detail page (e.g., /qmhq/{id})
started: After L1/L2/L3 SOR approval implementation (phases 55-58, migrations 063+)

## Eliminated

- hypothesis: Changed column names or relationships in qmhq_items or inventory_transactions from migration 063+
  evidence: The relevant migrations (two_layer_approval_schema) only modified stock_out_approvals (adding layer, parent_approval_id, warehouse_id) and trigger functions. The inventory_transactions table was NOT structurally changed in 063+.
  timestamp: 2026-02-18T00:01:00Z

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: qmhq_items schema (migration 035_qmhq_items.sql)
  found: Table has columns: id, qmhq_id, item_id, quantity, warehouse_id, created_at, created_by. NO conversion_rate column.
  implication: Frontend query at page.tsx line 197 explicitly requests conversion_rate from qmhq_items — this doesn't exist, causing 400.

- timestamp: 2026-02-18T00:01:00Z
  checked: 20260214200000_standard_unit_columns.sql (the migration that added conversion_rate to transaction tables)
  found: Added conversion_rate to po_line_items, invoice_line_items, inventory_transactions, stock_out_line_items. qmhq_items and stock_out_approvals were NOT included.
  implication: The migration deliberately or accidentally skipped qmhq_items and stock_out_approvals.

- timestamp: 2026-02-18T00:01:00Z
  checked: stock_out_approvals schema (migration 052_stock_out_requests.sql + all ALTER TABLE statements)
  found: stock_out_approvals has columns: id, line_item_id, approval_number, approved_quantity, decision, rejection_reason, decided_by, decided_at, is_active, created_by, updated_by, created_at, updated_at. The 20260217100000 migration added: layer, parent_approval_id, warehouse_id. NO conversion_rate column exists.
  implication: Frontend query at page.tsx line 250 requests conversion_rate from stock_out_approvals — doesn't exist, causing 400.

- timestamp: 2026-02-18T00:01:00Z
  checked: git log and git show f33d553 for app/(dashboard)/qmhq/[id]/page.tsx
  found: Commit f33d553 (feat(50-04): add standard qty to QMHQ detail and items summary progress) added conversion_rate to: (1) qmhq_items select, (2) inventory_transactions select, (3) stock_out_approvals sub-select, (4) stock_out_line_items sub-select. The inventory_transactions and stock_out_line_items additions are valid (columns exist). The qmhq_items and stock_out_approvals additions reference non-existent columns.
  implication: Root cause confirmed — two missing database columns that the frontend queries reference.

## Resolution

root_cause: Commit f33d553 added conversion_rate column references to the frontend queries for qmhq_items and stock_out_approvals tables, but migration 20260214200000_standard_unit_columns.sql only added the conversion_rate column to inventory_transactions and stock_out_line_items. The qmhq_items and stock_out_approvals tables were skipped in the migration. PostgREST returns HTTP 400 when a query explicitly names a column that doesn't exist on the table.
fix: Created migration 20260218100000_fix_missing_conversion_rate_columns.sql that adds conversion_rate DECIMAL(10,4) (with backfill to 1.0000 and NOT NULL + positive CHECK constraints) to both qmhq_items and stock_out_approvals, matching the pattern of the original standard_unit_columns migration.
verification: TypeScript type check passes (npm run type-check). No frontend changes required — the queries were already correct in intent, just needed the missing database columns. The 400 errors will resolve once the migration is applied to Supabase.
files_changed:
  - supabase/migrations/20260218100000_fix_missing_conversion_rate_columns.sql
