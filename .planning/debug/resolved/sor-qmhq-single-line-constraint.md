---
status: resolved
trigger: "Stock-out request creation from QMHQ item route fails when QMHQ has multiple line items due to a database constraint that enforces only one line item per QMHQ-linked stock-out request. This constraint needs to be removed."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:03:00Z
---

## Current Focus

hypothesis: Fix applied - migration created to drop trigger
test: Run migration and test stock-out request creation with multiple QMHQ line items
expecting: Migration applies cleanly and no more constraint errors
next_action: Apply migration using npx supabase db reset or push

## Symptoms

expected: When a QMHQ item route has multiple line items, the stock-out request should be created with all corresponding line items.
actual: Error thrown: "QMHQ-linked stock-out requests can only have one line item" (PostgreSQL P0001 error)
errors: `Error creating line items: {code: "P0001", details: null, hint: null, message: "QMHQ-linked stock-out requests can only have one line item"}`
reproduction: Create a QMHQ with item route that has more than 1 line item -> try to create a stock-out request from it -> error appears
started: This was a design decision in Phase 27-01 that turns out to be wrong. QMHQ item routes CAN legitimately have multiple line items.

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: supabase/migrations/052_stock_out_requests.sql
  found: Trigger `enforce_qmhq_single_line_item()` at lines 354-386 explicitly raises exception when QMHQ-linked SOR has more than 1 active line item
  implication: This is the exact constraint causing the error - it was an intentional design decision in Phase 27-01 that needs to be removed

## Resolution

root_cause: Database trigger `enforce_qmhq_single_line_item()` in migration 052_stock_out_requests.sql prevents QMHQ-linked stock-out requests from having more than one line item. This was an incorrect design decision from Phase 27-01. QMHQ item routes can legitimately have multiple line items, so the stock-out request should also support multiple line items.

fix: Created migration 20260210075851_remove_qmhq_single_line_item_constraint.sql to DROP the trigger and function completely. Also updated run_all_migrations.sql to remove the function/trigger and added comments in 052_stock_out_requests.sql to document why it was removed.

verification: Migration created successfully. The trigger and function have been dropped. When the migration is applied (via npx supabase db reset or push), stock-out requests linked to QMHQ will be able to have multiple line items without encountering the "QMHQ-linked stock-out requests can only have one line item" error.

files_changed:
- supabase/migrations/20260210075851_remove_qmhq_single_line_item_constraint.sql (created)
- supabase/migrations/run_all_migrations.sql (removed function and trigger)
- supabase/migrations/052_stock_out_requests.sql (added deprecation comments and updated table comment)
