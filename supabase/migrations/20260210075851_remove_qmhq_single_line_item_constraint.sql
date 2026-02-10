-- Migration: Remove QMHQ single line item constraint
-- Description: Remove the constraint that prevented QMHQ-linked stock-out requests from having multiple line items
-- Context: QMHQ item routes can legitimately have multiple line items, so stock-out requests should support this
-- Issue: sor-qmhq-single-line-constraint

-- Drop the trigger
DROP TRIGGER IF EXISTS trg_enforce_qmhq_single_line_item ON stock_out_line_items;

-- Drop the function
DROP FUNCTION IF EXISTS enforce_qmhq_single_line_item();

-- Add comment to document why this was removed
COMMENT ON COLUMN stock_out_requests.qmhq_id IS 'Optional 1:1 link to QMHQ item route (NULL for standalone requests). Multiple line items are allowed even when linked to QMHQ.';
