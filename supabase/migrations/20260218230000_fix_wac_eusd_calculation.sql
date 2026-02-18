-- Migration: 20260218230000_fix_wac_eusd_calculation.sql
-- Description: Fix WAC EUSD calculation so that wac_amount_eusd is computed
--   as a proper weighted-average EUSD cost, not just wac_amount / last_exchange_rate.
--
-- Root cause:
--   The items.wac_amount_eusd column was a GENERATED ALWAYS column computed as
--   ROUND(wac_amount / wac_exchange_rate, 2). The problem is that wac_exchange_rate
--   stores the exchange rate from the LAST stock-in transaction only. When an item
--   receives stock at multiple different exchange rates over time, the EUSD WAC is
--   incorrectly computed using the last rate instead of a weighted average of all rates.
--
--   Example of wrong behavior:
--     Stock in 100 units @ 1000 MMK, rate 4000: wac=1000, rate=4000, eusd_wac=0.25
--     Stock in 50 units @ 1500 MMK, rate 5000:  wac=1167, rate=5000, eusd_wac=0.23
--     Correct EUSD WAC = (100*0.25 + 50*0.30) / 150 = 0.267 EUSD, not 0.23
--     Wrong by ~14% - gets worse when rates differ more.
--
-- Fix:
--   1. Convert wac_amount_eusd from GENERATED ALWAYS to a regular stored column.
--   2. Update update_item_wac() trigger to compute EUSD WAC using the same
--      weighted-average formula applied in EUSD (unit_cost / exchange_rate).
--   3. Update handle_inventory_transaction_status_change() to also recompute EUSD WAC.
--   4. Backfill existing items by replaying their transaction history.

-- ============================================================================
-- STEP 1: Convert wac_amount_eusd from GENERATED ALWAYS to a regular column
-- ============================================================================
-- PostgreSQL 13+ supports DROP EXPRESSION to remove the generated constraint
-- while keeping existing data intact. The column retains its values.

ALTER TABLE items
  ALTER COLUMN wac_amount_eusd DROP EXPRESSION;

COMMENT ON COLUMN items.wac_amount_eusd IS
  'WAC in EUSD - maintained by update_item_wac() trigger using a weighted-average '
  'EUSD formula. Each stock-in contributes (quantity * unit_cost / exchange_rate) to the '
  'running EUSD total, giving an accurate blended EUSD cost rather than simply dividing '
  'the local-currency WAC by the most recent exchange rate.';

-- ============================================================================
-- STEP 2: Update update_item_wac() to compute EUSD WAC with correct formula
-- ============================================================================

CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  current_wac      DECIMAL(15,2);
  current_wac_eusd DECIMAL(15,4);
  current_qty      DECIMAL(15,2);
  new_wac          DECIMAL(15,2);
  new_wac_eusd     DECIMAL(15,4);
  total_qty        DECIMAL(15,2);
  existing_value      DECIMAL(15,2);
  existing_value_eusd DECIMAL(15,4);
  new_value           DECIMAL(15,2);
  new_value_eusd      DECIMAL(15,4);
  new_unit_cost_eusd  DECIMAL(15,8);
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

  -- Read current WAC (local + EUSD) and current net stock quantity
  -- The subquery sums all transactions EXCEPT the one just inserted (id != NEW.id)
  -- to avoid double-counting since this is an AFTER INSERT trigger.
  SELECT
    COALESCE(i.wac_amount, 0),
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
  INTO current_wac, current_wac_eusd, current_qty
  FROM items i
  WHERE i.id = NEW.item_id;

  -- Clamp to zero: stock should never go negative due to the validate trigger,
  -- but guard here just in case.
  current_qty := GREATEST(current_qty, 0);

  -- EUSD cost of the new units
  new_unit_cost_eusd := NEW.unit_cost / NEW.exchange_rate;

  -- Local-currency WAC
  existing_value := current_qty * current_wac;
  new_value      := NEW.quantity * NEW.unit_cost;
  total_qty      := current_qty + NEW.quantity;

  IF total_qty > 0 THEN
    new_wac := ROUND((existing_value + new_value) / total_qty, 2);
  ELSE
    new_wac := NEW.unit_cost;
  END IF;

  -- EUSD WAC - weighted average using EUSD costs, not local / last-rate
  existing_value_eusd := current_qty * current_wac_eusd;
  new_value_eusd      := NEW.quantity * new_unit_cost_eusd;

  IF total_qty > 0 THEN
    new_wac_eusd := ROUND((existing_value_eusd + new_value_eusd) / total_qty, 4);
  ELSE
    new_wac_eusd := ROUND(new_unit_cost_eusd, 4);
  END IF;

  -- Persist both WAC values
  UPDATE items
  SET
    wac_amount      = new_wac,
    wac_currency    = NEW.currency,
    wac_exchange_rate = NEW.exchange_rate,
    wac_amount_eusd = new_wac_eusd,
    updated_at      = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Update handle_inventory_transaction_status_change() to also recompute
--   wac_amount_eusd when recalculating WAC on transaction cancellation.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_inventory_transaction_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_wac      DECIMAL(15,2);
  new_wac_eusd DECIMAL(15,4);
  total_qty    DECIMAL(15,2);
  total_value  DECIMAL(15,2);
  total_value_eusd DECIMAL(15,4);
BEGIN
  -- Only handle transitions to cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN

    -- Recalculate WAC from all remaining costed stock-ins (excluding this one)
    IF OLD.movement_type = 'inventory_in'
       AND OLD.unit_cost IS NOT NULL
       AND OLD.unit_cost > 0
    THEN
      SELECT
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0),
        COALESCE(SUM(
          CASE
            WHEN exchange_rate IS NOT NULL AND exchange_rate > 0
            THEN quantity * (COALESCE(unit_cost, 0) / exchange_rate)
            ELSE 0
          END
        ), 0)
      INTO total_qty, total_value, total_value_eusd
      FROM inventory_transactions
      WHERE item_id    = OLD.item_id
        AND movement_type = 'inventory_in'
        AND is_active  = true
        AND status     = 'completed'
        AND id        != OLD.id;

      IF total_qty > 0 THEN
        new_wac      := ROUND(total_value      / total_qty, 2);
        new_wac_eusd := ROUND(total_value_eusd / total_qty, 4);
      ELSE
        new_wac      := 0;
        new_wac_eusd := 0;
      END IF;

      UPDATE items
      SET
        wac_amount      = new_wac,
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
-- STEP 4: Backfill wac_amount_eusd for all existing items
--   Replays every item's transaction history in chronological order to compute
--   the correct EUSD WAC using the same weighted-average formula.
--
--   Rules mirror the trigger:
--     - inventory_in with unit_cost > 0 and exchange_rate > 0: update EUSD WAC
--     - inventory_in with no cost: quantity added to running total, WAC unchanged
--     - inventory_out: quantity subtracted from running total, WAC unchanged
-- ============================================================================

DO $$
DECLARE
  item_rec RECORD;
  txn_rec  RECORD;

  -- Running state
  running_qty      DECIMAL(15,2);
  running_wac      DECIMAL(15,2);
  running_wac_eusd DECIMAL(15,4);

  -- Intermediates
  txn_ex_val      DECIMAL(15,2);
  txn_ex_val_eusd DECIMAL(15,4);
  txn_new_val     DECIMAL(15,2);
  txn_new_val_eusd DECIMAL(15,4);
  txn_total_qty   DECIMAL(15,2);
  txn_eusd_cost   DECIMAL(15,8);
BEGIN
  -- Process every item that appears in inventory_transactions
  FOR item_rec IN
    SELECT DISTINCT item_id FROM inventory_transactions
    WHERE is_active = true AND status = 'completed'
  LOOP
    running_qty      := 0;
    running_wac      := 0;
    running_wac_eusd := 0;

    -- Replay all completed active transactions in chronological order
    FOR txn_rec IN
      SELECT
        movement_type,
        quantity,
        unit_cost,
        COALESCE(exchange_rate, 1) AS exchange_rate
      FROM inventory_transactions
      WHERE item_id   = item_rec.item_id
        AND is_active = true
        AND status    = 'completed'
      ORDER BY transaction_date ASC, created_at ASC
    LOOP
      IF txn_rec.movement_type = 'inventory_in' THEN

        IF txn_rec.unit_cost IS NOT NULL
           AND txn_rec.unit_cost > 0
           AND txn_rec.exchange_rate > 0
        THEN
          -- Costed stock-in: update running WAC (local + EUSD)
          txn_eusd_cost    := txn_rec.unit_cost / txn_rec.exchange_rate;
          txn_ex_val       := running_qty * running_wac;
          txn_ex_val_eusd  := running_qty * running_wac_eusd;
          txn_new_val      := txn_rec.quantity * txn_rec.unit_cost;
          txn_new_val_eusd := txn_rec.quantity * txn_eusd_cost;
          txn_total_qty    := running_qty + txn_rec.quantity;

          IF txn_total_qty > 0 THEN
            running_wac      := ROUND((txn_ex_val      + txn_new_val)      / txn_total_qty, 2);
            running_wac_eusd := ROUND((txn_ex_val_eusd + txn_new_val_eusd) / txn_total_qty, 4);
          ELSE
            running_wac      := txn_rec.unit_cost;
            running_wac_eusd := ROUND(txn_eusd_cost, 4);
          END IF;

          running_qty := txn_total_qty;

        ELSE
          -- Zero-cost stock-in: quantity increases but WAC is unchanged
          running_qty := running_qty + txn_rec.quantity;
        END IF;

      ELSIF txn_rec.movement_type = 'inventory_out' THEN
        -- Stock-out: reduce quantity (WAC does not change)
        running_qty := GREATEST(running_qty - txn_rec.quantity, 0);
      END IF;
    END LOOP;

    -- Write the recomputed EUSD WAC back to items
    -- Only update if we actually had at least one costed transaction
    IF running_wac_eusd > 0 THEN
      UPDATE items
      SET wac_amount_eusd = running_wac_eusd,
          updated_at      = NOW()
      WHERE id = item_rec.item_id;
    END IF;
  END LOOP;
END $$;

-- Ensure items with no transaction history have wac_amount_eusd = 0 (not NULL)
UPDATE items SET wac_amount_eusd = 0 WHERE wac_amount_eusd IS NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION update_item_wac() IS
  'Updates item WAC (local currency AND EUSD) on completed inventory_in with unit_cost. '
  'Uses incremental weighted-average formula for both wac_amount and wac_amount_eusd. '
  'EUSD WAC uses unit_cost/exchange_rate per transaction rather than dividing the local '
  'WAC by the most recent exchange rate, giving correct blended EUSD costs.';

COMMENT ON FUNCTION handle_inventory_transaction_status_change() IS
  'Handles inventory_transaction status changes. On cancellation of a completed costed '
  'inventory_in, recalculates WAC (both local and EUSD) from all remaining transactions.';
