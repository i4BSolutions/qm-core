-- ============================================================================
-- Verification Script for po-received-qty-stale Fix
-- Migration: 20260212230000_fix_po_received_quantity_propagation.sql
-- ============================================================================
-- This script verifies the complete trigger chain from stock-in to PO status
-- Run after applying the migration to confirm the fix works
-- ============================================================================

-- Step 1: Verify the new trigger exists
SELECT
  tgname as trigger_name,
  tgtype as trigger_type,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname = 'invoice_line_update_po_received';
-- Expected: Should return 1 row showing the trigger exists

-- Step 2: Verify trigger function exists
SELECT
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'update_po_line_received_quantity';
-- Expected: Should return 1 row with the function

-- Step 3: Check current state of a PO with stock-in
-- (Replace the po_id with an actual PO that has had stock-in)
SELECT
  po.po_number,
  po.status as po_status,
  pli.item_name,
  pli.quantity as ordered_qty,
  pli.invoiced_quantity as invoiced_qty,
  pli.received_quantity as received_qty,
  COALESCE(SUM(ili.received_quantity), 0) as total_received_from_invoices
FROM purchase_orders po
JOIN po_line_items pli ON pli.po_id = po.id
LEFT JOIN invoice_line_items ili ON ili.po_line_item_id = pli.id AND ili.is_active = true
WHERE po.id = 'REPLACE_WITH_ACTUAL_PO_ID'
GROUP BY po.id, po.po_number, po.status, pli.id, pli.item_name, pli.quantity, pli.invoiced_quantity, pli.received_quantity;
-- Expected: received_qty should equal total_received_from_invoices
-- If they don't match, the trigger hasn't fired yet (need to update invoice_line_items.received_quantity)

-- Step 4: Test the trigger by simulating a stock-in update
-- This manually updates invoice_line_items.received_quantity to trigger the chain
-- (In real use, this happens automatically via inventory_transaction_update_invoice_received)
BEGIN;

-- Find an invoice line item that has received_quantity
SELECT
  ili.id,
  ili.received_quantity,
  pli.received_quantity as po_line_received
FROM invoice_line_items ili
JOIN po_line_items pli ON pli.id = ili.po_line_item_id
WHERE ili.received_quantity > 0
LIMIT 1;

-- Trigger the new trigger by updating received_quantity
-- (This simulates what happens when a stock-in occurs)
UPDATE invoice_line_items
SET received_quantity = received_quantity + 0.01
WHERE id = 'REPLACE_WITH_INVOICE_LINE_ITEM_ID';

-- Check if po_line_items.received_quantity updated
SELECT
  pli.id,
  pli.received_quantity as po_line_received_after
FROM po_line_items pli
WHERE id = (
  SELECT po_line_item_id
  FROM invoice_line_items
  WHERE id = 'REPLACE_WITH_INVOICE_LINE_ITEM_ID'
);

-- Check if PO status recalculated
SELECT
  po.po_number,
  po.status
FROM purchase_orders po
WHERE id = (
  SELECT po_id
  FROM po_line_items
  WHERE id = (
    SELECT po_line_item_id
    FROM invoice_line_items
    WHERE id = 'REPLACE_WITH_INVOICE_LINE_ITEM_ID'
  )
);

ROLLBACK;

-- Step 5: Verify existing data reconciliation
-- This query shows any POs where po_line_items.received_quantity doesn't match
-- the sum of invoice_line_items.received_quantity (these need to be recalculated)
SELECT
  po.po_number,
  pli.item_name,
  pli.received_quantity as current_po_line_received,
  COALESCE(SUM(ili.received_quantity), 0) as actual_total_received,
  COALESCE(SUM(ili.received_quantity), 0) - pli.received_quantity as discrepancy
FROM purchase_orders po
JOIN po_line_items pli ON pli.po_id = po.id
LEFT JOIN invoice_line_items ili ON ili.po_line_item_id = pli.id AND ili.is_active = true
WHERE po.is_active = true
GROUP BY po.id, po.po_number, pli.id, pli.item_name, pli.received_quantity
HAVING COALESCE(SUM(ili.received_quantity), 0) != pli.received_quantity;
-- Expected: If this returns rows, those POs need one-time recalculation
-- Run the recalculation query below to fix them

-- Step 6: One-time recalculation for existing data (if needed)
-- This updates all po_line_items.received_quantity to match invoice_line_items
UPDATE po_line_items
SET received_quantity = (
  SELECT COALESCE(SUM(ili.received_quantity), 0)
  FROM invoice_line_items ili
  WHERE ili.po_line_item_id = po_line_items.id
    AND ili.is_active = true
),
updated_at = NOW()
WHERE id IN (
  SELECT pli.id
  FROM po_line_items pli
  LEFT JOIN invoice_line_items ili ON ili.po_line_item_id = pli.id AND ili.is_active = true
  GROUP BY pli.id, pli.received_quantity
  HAVING COALESCE(SUM(ili.received_quantity), 0) != pli.received_quantity
);
-- This will trigger po_line_item_update_status to recalculate PO statuses

-- Step 7: Verify PO statuses are correct after recalculation
SELECT
  po.po_number,
  po.status,
  pli_totals.total_ordered,
  pli_totals.total_invoiced,
  pli_totals.total_received,
  CASE
    WHEN pli_totals.total_received >= pli_totals.total_ordered AND pli_totals.total_invoiced >= pli_totals.total_ordered THEN 'closed'
    WHEN pli_totals.total_invoiced > 0 AND pli_totals.total_invoiced < pli_totals.total_ordered THEN 'partially_invoiced'
    WHEN pli_totals.total_invoiced >= pli_totals.total_ordered AND pli_totals.total_received > 0 AND pli_totals.total_received < pli_totals.total_ordered THEN 'partially_received'
    WHEN pli_totals.total_invoiced >= pli_totals.total_ordered AND pli_totals.total_received = 0 THEN 'awaiting_delivery'
    ELSE 'not_started'
  END as expected_status,
  CASE
    WHEN po.status::text = CASE
      WHEN pli_totals.total_received >= pli_totals.total_ordered AND pli_totals.total_invoiced >= pli_totals.total_ordered THEN 'closed'
      WHEN pli_totals.total_invoiced > 0 AND pli_totals.total_invoiced < pli_totals.total_ordered THEN 'partially_invoiced'
      WHEN pli_totals.total_invoiced >= pli_totals.total_ordered AND pli_totals.total_received > 0 AND pli_totals.total_received < pli_totals.total_ordered THEN 'partially_received'
      WHEN pli_totals.total_invoiced >= pli_totals.total_ordered AND pli_totals.total_received = 0 THEN 'awaiting_delivery'
      ELSE 'not_started'
    END THEN 'CORRECT'
    ELSE 'MISMATCH'
  END as status_check
FROM purchase_orders po
JOIN (
  SELECT
    po_id,
    SUM(quantity) as total_ordered,
    SUM(invoiced_quantity) as total_invoiced,
    SUM(received_quantity) as total_received
  FROM po_line_items
  WHERE is_active = true
  GROUP BY po_id
) pli_totals ON pli_totals.po_id = po.id
WHERE po.is_active = true
  AND po.status != 'cancelled'
ORDER BY status_check DESC, po.po_number;
-- Expected: All rows should show status_check = 'CORRECT'
