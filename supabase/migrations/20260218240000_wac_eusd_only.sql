-- Migration: 20260218240000_wac_eusd_only.sql
-- Description: Simplify WAC to be EUSD-only.
--
-- Root cause (follow-up to 20260218230000_fix_wac_eusd_calculation.sql):
--   The previous migration correctly introduced a per-transaction EUSD
--   weighted-average for wac_amount_eusd, but it still updated wac_amount
--   (local-currency WAC) by mixing raw unit_cost values from different
--   currencies.  For example, after stock-ins of 100 units @ 20 USD and
--   100 units @ 1000 MMK, wac_amount becomes (100*20 + 100*1000)/200 = 510,
--   which is dimensionally meaningless — USD and MMK values cannot be averaged.
--
--   Additionally, wac_currency and wac_exchange_rate are set to the LAST
--   transaction's values, which gives a false impression that wac_amount can
--   be converted back to EUSD via those fields.
--
-- Fix:
--   1. Make wac_amount_eusd the single source of truth for WAC.
--      update_item_wac() now updates ONLY wac_amount_eusd.
--   2. wac_amount, wac_currency, wac_exchange_rate are no longer touched by
--      the WAC trigger — they remain for historical reference but are not
--      meaningful for items that have received stock in multiple currencies.
--   3. handle_inventory_transaction_status_change() likewise recalculates
--      ONLY wac_amount_eusd when a completed inventory_in is cancelled.
--   4. No backfill needed: the 20260218230000 migration already computed and
--      stored the correct EUSD WAC for all existing transactions.
--
-- Formula (unchanged from previous migration, now the only one used):
--   new_wac_eusd = (current_qty * current_wac_eusd + new_qty * (unit_cost / exchange_rate))
--                 / (current_qty + new_qty)
--
-- Edge case: when current_qty = 0 (first stock-in or fully sold out and
--   restocked), new_wac_eusd = unit_cost / exchange_rate directly.

-- ============================================================================
-- STEP 1: Replace update_item_wac() — EUSD WAC only
-- ============================================================================

CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  current_wac_eusd DECIMAL(15,4);
  current_qty      DECIMAL(15,2);
  new_unit_cost_eusd  DECIMAL(15,8);
  existing_value_eusd DECIMAL(15,4);
  new_value_eusd      DECIMAL(15,4);
  total_qty           DECIMAL(15,2);
  new_wac_eusd        DECIMAL(15,4);
BEGIN
  -- Only recalculate WAC for completed inventory_in with a valid unit_cost
  IF NEW.movement_type != 'inventory_in' THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
    RETURN NEW;
  END IF;

  -- Read current EUSD WAC and current net stock quantity.
  -- The subquery sums all transactions EXCEPT the one just inserted (id != NEW.id)
  -- to avoid double-counting since this is an AFTER INSERT trigger.
  SELECT
    COALESCE(i.wac_amount_eusd, 0),
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN t.movement_type = 'inventory_in'  THEN  t.quantity
          WHEN t.movement_type = 'inventory_out' THEN -t.quantity
          ELSE 0
        END
      ), 0)
      FROM inventory_transactions t
      WHERE t.item_id  = NEW.item_id
        AND t.is_active = true
        AND t.status    = 'completed'
        AND t.id       != NEW.id
    )
  INTO current_wac_eusd, current_qty
  FROM items i
  WHERE i.id = NEW.item_id;

  -- Clamp to zero: stock should never go negative due to the validate trigger,
  -- but guard here just in case.
  current_qty := GREATEST(current_qty, 0);

  -- EUSD cost of the new units
  new_unit_cost_eusd := NEW.unit_cost / NEW.exchange_rate;

  -- EUSD WAC — weighted average using EUSD costs
  existing_value_eusd := current_qty * current_wac_eusd;
  new_value_eusd      := NEW.quantity * new_unit_cost_eusd;
  total_qty           := current_qty + NEW.quantity;

  IF total_qty > 0 THEN
    new_wac_eusd := ROUND((existing_value_eusd + new_value_eusd) / total_qty, 4);
  ELSE
    new_wac_eusd := ROUND(new_unit_cost_eusd, 4);
  END IF;

  -- Persist EUSD WAC only. wac_amount / wac_currency / wac_exchange_rate are
  -- NOT updated here: they are meaningless for items that receive stock in
  -- multiple currencies and wac_amount_eusd is the single source of truth.
  UPDATE items
  SET
    wac_amount_eusd = new_wac_eusd,
    updated_at      = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Replace handle_inventory_transaction_status_change() — EUSD WAC only
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_inventory_transaction_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_wac_eusd     DECIMAL(15,4);
  total_qty        DECIMAL(15,2);
  total_value_eusd DECIMAL(15,4);
BEGIN
  -- Only handle transitions to cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN

    -- Recalculate EUSD WAC from all remaining costed stock-ins (excluding this one)
    IF OLD.movement_type = 'inventory_in'
       AND OLD.unit_cost IS NOT NULL
       AND OLD.unit_cost > 0
    THEN
      SELECT
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(
          CASE
            WHEN exchange_rate IS NOT NULL AND exchange_rate > 0
            THEN quantity * (COALESCE(unit_cost, 0) / exchange_rate)
            ELSE 0
          END
        ), 0)
      INTO total_qty, total_value_eusd
      FROM inventory_transactions
      WHERE item_id    = OLD.item_id
        AND movement_type = 'inventory_in'
        AND is_active  = true
        AND status     = 'completed'
        AND id        != OLD.id;

      IF total_qty > 0 THEN
        new_wac_eusd := ROUND(total_value_eusd / total_qty, 4);
      ELSE
        new_wac_eusd := 0;
      END IF;

      -- Update EUSD WAC only
      UPDATE items
      SET
        wac_amount_eusd = new_wac_eusd,
        updated_at      = NOW()
      WHERE id = OLD.item_id;
    END IF;

    -- Reverse invoice line item received quantity if applicable
    IF OLD.movement_type = 'inventory_in'
       AND OLD.invoice_line_item_id IS NOT NULL
    THEN
      UPDATE invoice_line_items
      SET received_quantity = GREATEST(COALESCE(received_quantity, 0) - OLD.quantity, 0),
          updated_at        = NOW()
      WHERE id = OLD.invoice_line_item_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION update_item_wac() IS
  'Updates item WAC (EUSD only) on completed inventory_in with unit_cost. '
  'Uses incremental weighted-average formula: '
  'new_wac_eusd = (current_qty * current_wac_eusd + new_qty * (unit_cost / exchange_rate)) / total_qty. '
  'wac_amount_eusd is the single source of truth for WAC. '
  'wac_amount / wac_currency / wac_exchange_rate are NOT updated by this trigger — '
  'they are meaningless when an item has received stock in multiple currencies.';

COMMENT ON FUNCTION handle_inventory_transaction_status_change() IS
  'Handles inventory_transaction status changes. On cancellation of a completed costed '
  'inventory_in, recalculates wac_amount_eusd from all remaining completed costed transactions. '
  'Does not touch wac_amount / wac_currency / wac_exchange_rate.';
