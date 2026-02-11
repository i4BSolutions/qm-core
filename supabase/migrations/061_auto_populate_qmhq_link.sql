-- Migration: 061_auto_populate_qmhq_link.sql
-- Description: Auto-populate qmhq_id in inventory_transactions from SOR chain
-- Dependencies: 052_stock_out_requests.sql, 023_inventory_transactions.sql
-- Phase: 34-database-trigger-hardening
-- Plan: 34-02
-- Purpose: Prevent orphaned transactions by auto-filling qmhq_id from the SOR chain
--          when a stock-out approval is executed (approval -> line_item -> request -> qmhq_id)

-- ============================================================================
-- AUTO-POPULATE QMHQ FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_populate_qmhq_from_sor()
RETURNS TRIGGER AS $$
DECLARE
  sor_qmhq_id UUID;
BEGIN
  -- Guard clause 1: Only for stock-outs
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  -- Guard clause 2: Only for SOR-linked transactions
  IF NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guard clause 3: Don't override if explicitly set
  IF NEW.qmhq_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Look up QMHQ from approval -> line item -> request
  SELECT r.qmhq_id INTO sor_qmhq_id
  FROM stock_out_approvals a
  JOIN stock_out_line_items li ON a.line_item_id = li.id
  JOIN stock_out_requests r ON li.request_id = r.id
  WHERE a.id = NEW.stock_out_approval_id;

  -- Auto-populate (may be NULL if SOR not linked to QMHQ — that's OK)
  NEW.qmhq_id := sor_qmhq_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_populate_qmhq_from_sor() IS 'Auto-populates qmhq_id in inventory_transactions from the SOR chain (approval -> line_item -> request -> qmhq_id) to prevent orphaned transactions';

-- ============================================================================
-- TRIGGER DEFINITION
-- ============================================================================

DROP TRIGGER IF EXISTS trg_auto_populate_qmhq_from_sor ON inventory_transactions;
CREATE TRIGGER trg_auto_populate_qmhq_from_sor
  BEFORE INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_qmhq_from_sor();

-- ============================================================================
-- BACKFILL EXISTING TRANSACTIONS
-- ============================================================================

-- Backfill existing SOR-linked transactions that have missing qmhq_id
UPDATE inventory_transactions it
SET qmhq_id = r.qmhq_id
FROM stock_out_approvals a
JOIN stock_out_line_items li ON a.line_item_id = li.id
JOIN stock_out_requests r ON li.request_id = r.id
WHERE it.stock_out_approval_id = a.id
  AND it.movement_type = 'inventory_out'
  AND it.qmhq_id IS NULL
  AND r.qmhq_id IS NOT NULL;
