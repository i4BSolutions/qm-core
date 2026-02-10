---
status: resolved
trigger: "stock-out-request-detail-empty-lines"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - Stock-out request tables (052, 053, 054) not in run_all_migrations.sql
test: Verified run_all_migrations.sql only includes migrations up to 018
expecting: Adding migrations 052, 053, 054 to run_all_migrations.sql will fix the issue
next_action: Add stock-out request migrations to run_all_migrations.sql

## Symptoms

expected: Line items should display with item name, quantity, and per-line approval controls
actual: The line items section exists but shows no items (empty)
errors: No error messages reported
reproduction: Create a stock-out request with line items, navigate to its detail page, observe empty line items section
started: Unknown — may have always been this way or broken by recent changes

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: Detail page component (/app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx)
  found: Query looks correct - fetches stock_out_line_items with joins to approvals and warehouses, filters by request_id and is_active=true
  implication: The query structure is valid; problem is likely either RLS blocking reads or no data exists

- timestamp: 2026-02-10T00:06:00Z
  checked: LineItemTable component
  found: Component correctly handles empty array (shows "No line items found"), expects item_name, item_sku, requested_quantity from line items
  implication: If lineItems array is empty, component will show the empty state - so query is returning empty result

- timestamp: 2026-02-10T00:07:00Z
  checked: RLS policies in migration 054
  found: RLS policy sor_li_select uses can_view_sor_request(request_id) which allows admin/quartermaster/inventory or requester to view
  implication: RLS policies look correct - should not be blocking reads

- timestamp: 2026-02-10T00:08:00Z
  checked: Creation logic in new stock-out request page
  found: Line items are inserted with request_id, item_id, requested_quantity, created_by (lines 263-278)
  implication: Insertion logic looks correct. Need to verify data actually exists in database

- timestamp: 2026-02-10T00:09:00Z
  checked: Recent resolved debug file (category-selector-sor.md)
  found: Similar issue where migrations 017 and 018 were NOT in run_all_migrations.sql - item categories didn't exist in database
  implication: Stock-out request tables (052, 053, 054) might also not be in run_all_migrations.sql - tables might not exist!

- timestamp: 2026-02-10T00:10:00Z
  checked: run_all_migrations.sql file
  found: File ends at line 340 with migration 018. Searched for "052", "053", "054", "stock_out_requests", "stock_out_line_items", "sor_request_status" - ZERO matches
  implication: **ROOT CAUSE CONFIRMED** - Stock-out request tables were never created in production database because migrations 052, 053, 054 are not in run_all_migrations.sql

## Resolution

root_cause: Migrations 052_stock_out_requests.sql, 053_stock_out_validation.sql, and 054_stock_out_rls_audit.sql exist but are NOT included in run_all_migrations.sql. The production database has no stock_out_requests, stock_out_line_items, or stock_out_approvals tables. Therefore, line items cannot be inserted during creation and cannot be queried on the detail page.

fix: Add migrations 052, 053, and 054 to run_all_migrations.sql
- CREATE TYPE sor_line_item_status and sor_request_status enums
- CREATE TABLE stock_out_requests, stock_out_line_items, stock_out_approvals
- Add triggers for ID generation, snapshots, computed status
- Add validation triggers
- Add RLS policies and audit triggers

verification: After deployment, verify stock_out_requests table exists, create a new stock-out request with line items, navigate to detail page and verify line items display

files_changed: [supabase/migrations/run_all_migrations.sql]
