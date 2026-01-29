-- Migration: 034_qmhq_auto_stockout.sql
-- Description: Auto-create inventory_out when QMHQ item route status changes to 'done'

-- Create trigger function
CREATE OR REPLACE FUNCTION auto_stockout_on_qmhq_fulfilled()
RETURNS TRIGGER AS $$
DECLARE
  status_is_done BOOLEAN;
BEGIN
  -- Check if new status is in 'done' group
  SELECT status_group = 'done'
  INTO status_is_done
  FROM status_config
  WHERE id = NEW.status_id;

  -- Only proceed if:
  -- 1. Status actually changed
  -- 2. New status is 'done' (fulfilled/completed)
  -- 3. Route type is 'item'
  -- 4. Item and warehouse specified (legacy single-item)
  -- 5. No stock-out exists yet for this QMHQ (idempotency)
  IF (OLD.status_id IS DISTINCT FROM NEW.status_id)
     AND status_is_done = true
     AND NEW.route_type = 'item'
     AND NEW.item_id IS NOT NULL
     AND NEW.warehouse_id IS NOT NULL
     AND NEW.quantity > 0
     AND NOT EXISTS (
       SELECT 1 FROM inventory_transactions
       WHERE qmhq_id = NEW.id
       AND movement_type = 'inventory_out'
       AND reason = 'request'
       AND is_active = true
     )
  THEN
    -- Create inventory_out transaction
    INSERT INTO inventory_transactions (
      movement_type,
      item_id,
      warehouse_id,
      quantity,
      reason,
      qmhq_id,
      transaction_date,
      notes,
      status,
      created_by
    ) VALUES (
      'inventory_out',
      NEW.item_id,
      NEW.warehouse_id,
      NEW.quantity,
      'request',
      NEW.id,
      CURRENT_DATE,
      'Auto stock-out from ' || NEW.request_id,
      'completed',
      COALESCE(NEW.updated_by, NEW.created_by)
    );

    RAISE NOTICE 'Created auto stock-out for QMHQ %', NEW.request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to qmhq table
DROP TRIGGER IF EXISTS qmhq_auto_stockout ON qmhq;
CREATE TRIGGER qmhq_auto_stockout
  AFTER UPDATE ON qmhq
  FOR EACH ROW
  EXECUTE FUNCTION auto_stockout_on_qmhq_fulfilled();

-- Comments
COMMENT ON FUNCTION auto_stockout_on_qmhq_fulfilled() IS
  'Automatically creates inventory_out transaction when QMHQ item route status changes to done group';
