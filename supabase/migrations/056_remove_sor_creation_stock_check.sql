-- Migration: 056_remove_sor_creation_stock_check.sql
-- Description: Remove stock validation at line item creation time.
-- Stock-out requests are approval workflows — stock availability
-- should be validated at approval time (already handled by
-- validate_sor_approval), not at request creation time.

DROP TRIGGER IF EXISTS trg_validate_sor_li_creation ON stock_out_line_items;
DROP FUNCTION IF EXISTS validate_sor_line_item_creation();
