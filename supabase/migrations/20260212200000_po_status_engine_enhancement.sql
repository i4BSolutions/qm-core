-- ============================================================================
-- Migration: 20260212200000_po_status_engine_enhancement.sql
-- Phase: 41-po-status-engine-enhancement
-- Description: Enhance PO status calculation engine with invoice-first priority,
--              advisory locks for concurrency safety, and cancellation infrastructure
-- ============================================================================

-- Add cancellation columns to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);

COMMENT ON COLUMN purchase_orders.cancellation_reason IS 'Reason for PO cancellation (mandatory when status = cancelled)';
COMMENT ON COLUMN purchase_orders.cancelled_at IS 'Timestamp when PO was cancelled';
COMMENT ON COLUMN purchase_orders.cancelled_by IS 'User who cancelled the PO';

-- Add index for cancellation queries
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cancelled_at ON purchase_orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Replace calculate_po_status() with invoice-first priority logic (POSE-03)
-- Includes advisory lock for concurrency safety
CREATE OR REPLACE FUNCTION calculate_po_status(p_po_id UUID)
RETURNS po_status AS $$
DECLARE
  total_ordered DECIMAL(15,2);
  total_invoiced DECIMAL(15,2);
  total_received DECIMAL(15,2);
  current_status po_status;
  is_cancelled BOOLEAN;
BEGIN
  -- Acquire transaction-level advisory lock on PO
  -- Serializes concurrent status calculations for the same PO
  -- Lock automatically released on COMMIT or ROLLBACK
  PERFORM pg_advisory_xact_lock(hashtext(p_po_id::text));

  -- Check if PO is cancelled (bypass auto-calc)
  SELECT status = 'cancelled' INTO is_cancelled
  FROM purchase_orders
  WHERE id = p_po_id;

  IF is_cancelled THEN
    RETURN 'cancelled'::po_status;
  END IF;

  -- Get totals from line items
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(invoiced_quantity), 0),
    COALESCE(SUM(received_quantity), 0)
  INTO total_ordered, total_invoiced, total_received
  FROM po_line_items
  WHERE po_id = p_po_id
    AND is_active = true;

  -- Determine status based on totals with invoice-first priority
  IF total_ordered = 0 THEN
    RETURN 'not_started'::po_status;
  END IF;

  -- Check if fully matched (closed) - 3-way match
  IF total_received >= total_ordered AND total_invoiced >= total_ordered THEN
    RETURN 'closed'::po_status;
  END IF;

  -- INVOICE TAKES PRIORITY: Check if partially invoiced
  -- Show partially_invoiced even if some items are received
  IF total_invoiced > 0 AND total_invoiced < total_ordered THEN
    RETURN 'partially_invoiced'::po_status;
  END IF;

  -- After fully invoiced, check receiving progress
  -- Check if partially received (only after fully invoiced)
  IF total_invoiced >= total_ordered AND total_received > 0 AND total_received < total_ordered THEN
    RETURN 'partially_received'::po_status;
  END IF;

  -- Check if awaiting delivery (fully invoiced but not received)
  IF total_invoiced >= total_ordered AND total_received = 0 THEN
    RETURN 'awaiting_delivery'::po_status;
  END IF;

  -- Default to not_started
  RETURN 'not_started'::po_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_po_status IS 'Calculate PO smart status with invoice-first priority and advisory lock for concurrency safety';

-- Create cancellation audit trigger function
-- Uses zz_ prefix so it fires AFTER other triggers (following migration 040-041 convention)
CREATE OR REPLACE FUNCTION zz_audit_po_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  cancelling_user_id UUID;
  cancelling_user_name TEXT;
  qmhq_rec RECORD;
  released_amount DECIMAL(15,2);
BEGIN
  -- Only act when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN

    -- Get user who cancelled the PO
    cancelling_user_id := COALESCE(NEW.cancelled_by, NEW.updated_by);
    SELECT full_name INTO cancelling_user_name
    FROM public.users
    WHERE id = cancelling_user_id;
    cancelling_user_name := COALESCE(cancelling_user_name, 'System');

    -- Get QMHQ details for budget release logging
    SELECT id, request_id, total_money_in, total_po_committed
    INTO qmhq_rec
    FROM public.qmhq
    WHERE id = NEW.qmhq_id;

    released_amount := NEW.total_amount_eusd;

    -- Log cancellation in PO audit
    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      changes_summary,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      'purchase_orders',
      NEW.id,
      'cancel',
      'PO ' || NEW.po_number || ' cancelled. Reason: ' ||
        COALESCE(NEW.cancellation_reason, 'Not specified'),
      cancelling_user_id,
      cancelling_user_name,
      NOW()
    );

    -- Log budget release in QMHQ audit
    -- This happens automatically via update_qmhq_po_committed trigger
    -- which excludes cancelled POs from the SUM
    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      changes_summary,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      'qmhq',
      qmhq_rec.id,
      'status_change',
      'Budget released from cancelled PO ' || NEW.po_number ||
        ': ' || released_amount::TEXT || ' EUSD. Request: ' || qmhq_rec.request_id,
      cancelling_user_id,
      cancelling_user_name,
      NOW()
    );

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION zz_audit_po_cancellation IS 'Audit trigger for PO cancellation - logs cancellation event and budget release to parent QMHQ';

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS zz_audit_po_cancellation ON purchase_orders;
CREATE TRIGGER zz_audit_po_cancellation
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION zz_audit_po_cancellation();

-- Add comment on trigger
COMMENT ON TRIGGER zz_audit_po_cancellation ON purchase_orders IS 'Fires after PO status update to log cancellation and budget release';
