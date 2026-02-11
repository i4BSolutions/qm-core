-- Migration: 062_idempotency_constraint_execution.sql
-- Description: Idempotency constraint preventing duplicate approval execution
-- Dependencies: 052_stock_out_requests.sql, 023_inventory_transactions.sql
-- Phase: 34-database-trigger-hardening
-- Plan: 34-02
-- Purpose: Prevent the same approval from being executed more than once during
--          per-line-item execution, while allowing manual stock-outs to proceed normally

-- ============================================================================
-- CLEANUP EXISTING DUPLICATES
-- ============================================================================

-- Identify and clean up any existing duplicate executions
-- Keep only the most recent completed transaction per approval_id
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY stock_out_approval_id
      ORDER BY created_at DESC
    ) as rn
  FROM inventory_transactions
  WHERE stock_out_approval_id IS NOT NULL
    AND movement_type = 'inventory_out'
    AND status = 'completed'
    AND is_active = true
)
UPDATE inventory_transactions
SET is_active = false,
    notes = COALESCE(notes || ' | ', '') || 'Auto-deactivated: duplicate execution (Phase 34 data migration)'
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- ============================================================================
-- PARTIAL UNIQUE INDEX
-- ============================================================================

-- Create partial unique index to enforce idempotency
-- Only applies to: inventory_out + completed + active + non-NULL approval_id
-- Manual stock-outs (NULL approval_id) are unaffected
-- Cancelled/pending transactions don't count
-- Soft-deleted transactions (is_active=false) don't count
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_approval_execution
  ON inventory_transactions(stock_out_approval_id)
  WHERE movement_type = 'inventory_out'
    AND status = 'completed'
    AND is_active = true;

COMMENT ON INDEX idx_unique_approval_execution IS 'Ensures each stock_out_approval can only be executed once. Partial index allows manual stock-outs (NULL approval_id) and excludes non-completed/inactive transactions.';
