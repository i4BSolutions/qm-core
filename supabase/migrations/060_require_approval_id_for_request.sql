-- ============================================================================
-- Migration: 060_require_approval_id_for_request.sql
-- Phase: 34-database-trigger-hardening
-- Description: Enforce that inventory_out transactions with reason='request'
--              must have stock_out_approval_id set (prevents orphaned records)
-- ============================================================================

-- Step 1: Data migration - Fix orphaned transactions BEFORE adding constraint
-- Change reason to 'adjustment' for any orphaned request-based stock-outs
UPDATE inventory_transactions
SET reason = 'adjustment',
    notes = COALESCE(notes || ' | ', '') || 'Auto-fixed: was reason=request without approval_id (Phase 34 data migration)'
WHERE movement_type = 'inventory_out'
  AND reason = 'request'
  AND stock_out_approval_id IS NULL
  AND is_active = true;

-- Step 2: Add CHECK constraint to enforce approval_id requirement
ALTER TABLE inventory_transactions
  ADD CONSTRAINT check_approval_id_for_request
  CHECK (
    movement_type != 'inventory_out'
    OR reason != 'request'
    OR stock_out_approval_id IS NOT NULL
  );

COMMENT ON CONSTRAINT check_approval_id_for_request ON inventory_transactions IS
  'Ensures request-based stock-outs (reason=request) are always linked to an approval (prevents orphaned transactions)';
