-- Migration: 024_inventory_wac_trigger.sql
-- Description: WAC (Weighted Average Cost) calculation trigger and inventory views

-- Function to update item WAC on inventory_in
CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  current_wac DECIMAL(15,2);
  current_qty DECIMAL(15,2);
  new_wac DECIMAL(15,2);
  total_qty DECIMAL(15,2);
  existing_value DECIMAL(15,2);
  new_value DECIMAL(15,2);
BEGIN
  -- Only calculate WAC for completed inventory_in with unit_cost
  IF NEW.movement_type != 'inventory_in' THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get current item WAC and calculate current stock quantity
  SELECT
    COALESCE(wac_amount, 0),
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN movement_type = 'inventory_in' THEN quantity
          WHEN movement_type = 'inventory_out' THEN -quantity
          ELSE 0
        END
      ), 0)
      FROM inventory_transactions
      WHERE item_id = NEW.item_id
        AND is_active = true
        AND status = 'completed'
        AND id != NEW.id  -- Exclude current transaction
    )
  INTO current_wac, current_qty
  FROM items
  WHERE id = NEW.item_id;

  -- Ensure non-negative stock for WAC calculation
  current_qty := GREATEST(current_qty, 0);

  -- Calculate new WAC
  -- WAC = (existing_value + new_value) / total_qty
  existing_value := current_qty * current_wac;
  new_value := NEW.quantity * NEW.unit_cost;
  total_qty := current_qty + NEW.quantity;

  IF total_qty > 0 THEN
    new_wac := ROUND((existing_value + new_value) / total_qty, 2);
  ELSE
    new_wac := NEW.unit_cost;
  END IF;

  -- Update item WAC
  UPDATE items
  SET
    wac_amount = new_wac,
    wac_currency = NEW.currency,
    wac_exchange_rate = NEW.exchange_rate,
    updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update WAC after inventory_in
DROP TRIGGER IF EXISTS inventory_transaction_update_wac ON inventory_transactions;
CREATE TRIGGER inventory_transaction_update_wac
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_item_wac();

-- Function to update invoice_line_items.received_quantity
CREATE OR REPLACE FUNCTION update_invoice_line_received_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process inventory_in transactions with invoice_line_item_id
  IF NEW.movement_type = 'inventory_in' AND NEW.invoice_line_item_id IS NOT NULL THEN
    IF NEW.status = 'completed' THEN
      -- Add quantity on completed insert
      UPDATE invoice_line_items
      SET received_quantity = COALESCE(received_quantity, 0) + NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.invoice_line_item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice line item received quantity
DROP TRIGGER IF EXISTS inventory_transaction_update_invoice_received ON inventory_transactions;
CREATE TRIGGER inventory_transaction_update_invoice_received
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_line_received_quantity();

-- Function to handle transaction cancellation (reverse WAC is complex, so we recalculate)
CREATE OR REPLACE FUNCTION handle_inventory_transaction_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_wac DECIMAL(15,2);
  total_qty DECIMAL(15,2);
  total_value DECIMAL(15,2);
BEGIN
  -- Only handle status changes to cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    -- If this was an inventory_in with unit_cost, recalculate WAC
    IF OLD.movement_type = 'inventory_in' AND OLD.unit_cost IS NOT NULL THEN
      -- Recalculate WAC from all remaining completed transactions
      SELECT
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0)
      INTO total_qty, total_value
      FROM inventory_transactions
      WHERE item_id = OLD.item_id
        AND movement_type = 'inventory_in'
        AND is_active = true
        AND status = 'completed'
        AND id != OLD.id;

      IF total_qty > 0 THEN
        new_wac := ROUND(total_value / total_qty, 2);
      ELSE
        new_wac := 0;
      END IF;

      UPDATE items
      SET wac_amount = new_wac,
          updated_at = NOW()
      WHERE id = OLD.item_id;
    END IF;

    -- Reverse invoice line item received quantity if applicable
    IF OLD.movement_type = 'inventory_in' AND OLD.invoice_line_item_id IS NOT NULL THEN
      UPDATE invoice_line_items
      SET received_quantity = GREATEST(COALESCE(received_quantity, 0) - OLD.quantity, 0),
          updated_at = NOW()
      WHERE id = OLD.invoice_line_item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle status changes
DROP TRIGGER IF EXISTS inventory_transaction_status_change ON inventory_transactions;
CREATE TRIGGER inventory_transaction_status_change
  AFTER UPDATE OF status ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_inventory_transaction_status_change();

-- View for warehouse inventory with WAC valuation
CREATE OR REPLACE VIEW warehouse_inventory AS
SELECT
  w.id as warehouse_id,
  w.name as warehouse_name,
  w.location as warehouse_location,
  i.id as item_id,
  i.name as item_name,
  i.sku as item_sku,
  i.default_unit as item_unit,
  i.wac_amount,
  i.wac_currency,
  i.wac_exchange_rate,
  i.wac_amount_eusd,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) as current_stock,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) * COALESCE(i.wac_amount, 0) as total_value,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) * COALESCE(i.wac_amount_eusd, 0) as total_value_eusd
FROM warehouses w
CROSS JOIN items i
LEFT JOIN inventory_transactions t ON t.warehouse_id = w.id
  AND t.item_id = i.id
  AND t.is_active = true
  AND t.status = 'completed'
WHERE w.is_active = true
  AND i.is_active = true
GROUP BY w.id, w.name, w.location, i.id, i.name, i.sku, i.default_unit,
         i.wac_amount, i.wac_currency, i.wac_exchange_rate, i.wac_amount_eusd
HAVING COALESCE(SUM(
  CASE
    WHEN t.movement_type = 'inventory_in' THEN t.quantity
    WHEN t.movement_type = 'inventory_out' THEN -t.quantity
    ELSE 0
  END
), 0) > 0;

-- View for item stock across all warehouses
CREATE OR REPLACE VIEW item_stock_summary AS
SELECT
  i.id as item_id,
  i.name as item_name,
  i.sku as item_sku,
  i.default_unit as item_unit,
  i.wac_amount,
  i.wac_currency,
  i.wac_exchange_rate,
  i.wac_amount_eusd,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) as total_stock,
  COUNT(DISTINCT t.warehouse_id) as warehouse_count,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) * COALESCE(i.wac_amount, 0) as total_value,
  COALESCE(SUM(
    CASE
      WHEN t.movement_type = 'inventory_in' THEN t.quantity
      WHEN t.movement_type = 'inventory_out' THEN -t.quantity
      ELSE 0
    END
  ), 0) * COALESCE(i.wac_amount_eusd, 0) as total_value_eusd
FROM items i
LEFT JOIN inventory_transactions t ON t.item_id = i.id
  AND t.is_active = true
  AND t.status = 'completed'
WHERE i.is_active = true
GROUP BY i.id, i.name, i.sku, i.default_unit,
         i.wac_amount, i.wac_currency, i.wac_exchange_rate, i.wac_amount_eusd;

-- Function to get current stock for an item in a warehouse
CREATE OR REPLACE FUNCTION get_warehouse_stock(p_item_id UUID, p_warehouse_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'inventory_in' THEN quantity
        WHEN movement_type = 'inventory_out' THEN -quantity
        ELSE 0
      END
    ), 0)
    FROM inventory_transactions
    WHERE item_id = p_item_id
      AND warehouse_id = p_warehouse_id
      AND is_active = true
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to validate stock availability for stock out
CREATE OR REPLACE FUNCTION validate_stock_out_quantity()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
BEGIN
  -- Only validate inventory_out transactions
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  -- Only validate completed transactions
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get available stock
  available_stock := get_warehouse_stock(NEW.item_id, NEW.warehouse_id);

  -- For updates, add back the old quantity if it was from the same transaction
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    available_stock := available_stock + OLD.quantity;
  END IF;

  -- Validate quantity
  IF NEW.quantity > available_stock THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %',
      NEW.quantity, available_stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate stock out quantity
DROP TRIGGER IF EXISTS inventory_transaction_validate_stock ON inventory_transactions;
CREATE TRIGGER inventory_transaction_validate_stock
  BEFORE INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_stock_out_quantity();

-- Comments
COMMENT ON FUNCTION update_item_wac() IS 'Updates item WAC based on inventory_in transactions';
COMMENT ON FUNCTION get_warehouse_stock(UUID, UUID) IS 'Returns current stock quantity for an item in a warehouse';
COMMENT ON VIEW warehouse_inventory IS 'Shows current inventory per warehouse with WAC valuation';
COMMENT ON VIEW item_stock_summary IS 'Shows total stock across all warehouses for each item';
