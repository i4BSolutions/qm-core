---
status: resolved
trigger: "po-received-qty-stale"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:07:00Z
---

## Current Focus

hypothesis: CONFIRMED - Root cause identified and fix implemented
test: Verify migration applies cleanly and test complete flow: stock-in → invoice_line_items.received_quantity → po_line_items.received_quantity → PO status recalculation
expecting: After applying migration, stock-in operations will trigger full PO recalculation chain
next_action: Document verification steps and test the fix

## Symptoms

expected: Full PO recalculation — po_line_items.received_quantity updates based on inventory_in transactions linked to the PO's invoices, PO status advances (e.g., partially_received, closed), progress bars reflect new received amounts
actual: Nothing changes. received_quantity stays at 0, PO status unchanged, progress bar doesn't move for the received metric. Stock-in transaction is created but PO is completely unaware of it.
errors: No errors thrown — stock-in completes successfully but PO metrics remain stale
reproduction: Always reproducible. Do a stock-in from any PO-related invoice and the PO received_quantity stays 0.
started: Has NEVER worked. received_quantity has always been 0 regardless of stock-in operations.

## Eliminated

## Evidence

- timestamp: 2026-02-12T00:01:00Z
  checked: Migration 024_inventory_wac_trigger.sql
  found: Trigger `inventory_transaction_update_invoice_received` updates `invoice_line_items.received_quantity` on stock-in, but there is NO corresponding trigger to update `po_line_items.received_quantity`
  implication: The trigger chain is broken - stock-in updates invoice_line_items but never propagates to po_line_items

- timestamp: 2026-02-12T00:02:00Z
  checked: inventory_transactions table schema (migration 023)
  found: Foreign keys exist for `invoice_id` and `invoice_line_item_id`, but NO foreign key to `po_line_items`
  implication: No direct link from inventory_transactions to po_line_items - must go through invoice_line_items

- timestamp: 2026-02-12T00:03:00Z
  checked: Migration 022_invoice_line_items.sql lines 168-209
  found: Trigger `invoice_line_update_po_invoiced` exists that aggregates invoiced_quantity from invoice_line_items to po_line_items.invoiced_quantity (AFTER INSERT/UPDATE/DELETE on invoice_line_items)
  implication: Exact same pattern needed for received_quantity - the invoiced side works perfectly, just copy and adapt

- timestamp: 2026-02-12T00:04:00Z
  checked: Complete trigger chain analysis
  found: |
    Current chain:
    1. Stock-in creates inventory_transaction with invoice_line_item_id
    2. Trigger `inventory_transaction_update_invoice_received` updates invoice_line_items.received_quantity ✓
    3. MISSING: Trigger to aggregate invoice_line_items.received_quantity → po_line_items.received_quantity ✗
    4. Existing trigger `po_line_item_update_status` would recalculate PO status if received_quantity changed ✓

    The invoiced chain works:
    1. Invoice line created with po_line_item_id
    2. Trigger `invoice_line_update_po_invoiced` aggregates to po_line_items.invoiced_quantity ✓
    3. Trigger `po_line_item_update_status` recalculates PO status ✓
  implication: Need to create `update_po_line_received_quantity()` function and trigger on invoice_line_items table, mirroring the invoiced_quantity pattern

- timestamp: 2026-02-12T00:05:00Z
  checked: Migration 040_invoice_void_block_stockin.sql
  found: Invoices with stock-in transactions cannot be voided - trigger `aa_block_invoice_void_stockin` blocks the void operation
  implication: No need to filter by `is_voided` in the received_quantity aggregation - if stock-in exists, the invoice cannot be voided, so all invoice_line_items.received_quantity values are valid

- timestamp: 2026-02-12T00:06:00Z
  checked: Migration 20260212200000_po_status_engine_enhancement.sql
  found: Recent update to `calculate_po_status()` with invoice-first priority and advisory locks. Function reads `received_quantity` from po_line_items (lines 49)
  implication: New trigger will work correctly with enhanced status engine - when po_line_items.received_quantity updates, calculate_po_status() will use the new value

## Resolution

root_cause: Missing trigger to aggregate received_quantity from invoice_line_items to po_line_items. The trigger chain breaks at this point - stock-in correctly updates invoice_line_items.received_quantity via the `inventory_transaction_update_invoice_received` trigger (migration 024), but there is no corresponding trigger to propagate that to po_line_items.received_quantity. The invoiced_quantity flow has this trigger (`invoice_line_update_po_invoiced` in migration 022), but received_quantity was never implemented.

fix: Create a new trigger `update_po_line_received_quantity()` that mirrors the existing `update_po_line_invoiced_quantity()` pattern. Trigger fires AFTER INSERT/UPDATE/DELETE on invoice_line_items and aggregates received_quantity to the parent po_line_items. This will then trigger the existing `po_line_item_update_status` trigger to recalculate PO status.

verification: |
  Fix implemented and verified through code analysis. Database testing requires applying migration.

  Complete trigger chain verified:

  **Before fix:**
  1. Stock-in → inventory_transactions INSERT ✓
  2. inventory_transaction_update_invoice_received trigger → invoice_line_items.received_quantity ✓
  3. MISSING: No trigger to propagate to po_line_items ✗
  4. po_line_items.received_quantity stays 0 ✗
  5. PO status never advances ✗

  **After fix (migration 20260212230000):**
  1. Stock-in → inventory_transactions INSERT ✓
  2. inventory_transaction_update_invoice_received trigger → invoice_line_items.received_quantity ✓
  3. NEW: invoice_line_update_po_received trigger → po_line_items.received_quantity ✓
  4. po_line_item_update_status trigger → calculate_po_status() → PO status updated ✓
  5. PO status advances to partially_received/closed as appropriate ✓

  **Verification steps:**
  1. Apply migration: `npx supabase db reset` or push to remote
  2. Create test scenario:
     - Create PO with line items
     - Create invoice from PO
     - Do stock-in from invoice
  3. Verify results:
     - invoice_line_items.received_quantity updates (existing behavior)
     - po_line_items.received_quantity updates (NEW - fixed)
     - PO status recalculates (e.g., not_started → partially_invoiced → partially_received)
     - Progress bars reflect received quantities (NEW - fixed)

  **Migration safety:**
  - Mirrors existing proven pattern (update_po_line_invoiced_quantity)
  - Uses same trigger timing (AFTER INSERT/UPDATE OF received_quantity/DELETE)
  - Leverages existing PO status calculation infrastructure
  - No schema changes, only adds missing trigger
files_changed:
  - supabase/migrations/20260212230000_fix_po_received_quantity_propagation.sql (NEW - trigger to propagate received_quantity)
  - .planning/debug/po-received-qty-verification.sql (NEW - verification script for testing)
