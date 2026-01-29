-- ============================================
-- Migration: 041_invoice_void_cascade_audit.sql
-- Description: Audit logging for invoice void cascade effects
-- ============================================
-- This migration adds an AFTER UPDATE trigger that logs all cascade
-- effects when an invoice is voided:
-- - PO line item invoiced_quantity changes
-- - PO status recalculations
--
-- Note: The existing audit trigger (create_audit_log) already logs the
-- void action itself on the invoices table. This trigger adds the
-- CASCADE EFFECTS by querying affected tables AFTER the cascade triggers
-- have completed.
--
-- Trigger ordering:
-- - 'zz_' prefix ensures this trigger fires LAST (alphabetically)
-- - Must fire after invoice_void_recalculate and trigger_update_po_status
-- - Sequence: recalculate -> po_status -> audit_invoices -> zz_audit_void_cascade
--
-- Security:
-- - SECURITY DEFINER allows the function to write to audit_logs
-- - SET search_path prevents search_path injection attacks
-- ============================================

-- Function to audit invoice void cascade effects
CREATE OR REPLACE FUNCTION audit_invoice_void_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  voiding_user_id UUID;
  voiding_user_name TEXT;
  po_line_rec RECORD;
  affected_po_ids UUID[] := ARRAY[]::UUID[];
  po_rec RECORD;
BEGIN
  -- Only act when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN

    -- Get user who voided the invoice
    voiding_user_id := COALESCE(NEW.voided_by, NEW.updated_by);
    SELECT full_name INTO voiding_user_name
    FROM public.users
    WHERE id = voiding_user_id;
    voiding_user_name := COALESCE(voiding_user_name, 'System');

    -- Log each affected PO line item's invoiced_quantity change
    -- The recalculate_po_on_invoice_void trigger has already updated these
    -- We calculate old value as: current (new) value + voided quantity
    FOR po_line_rec IN
      SELECT DISTINCT
        pl.id AS po_line_id,
        pl.po_id,
        pl.invoiced_quantity AS new_invoiced_qty,
        ili.quantity AS voided_qty,
        po.po_number,
        i.name AS item_name
      FROM public.invoice_line_items ili
      JOIN public.po_line_items pl ON pl.id = ili.po_line_item_id
      JOIN public.purchase_orders po ON po.id = pl.po_id
      LEFT JOIN public.items i ON i.id = pl.item_id
      WHERE ili.invoice_id = NEW.id
        AND ili.is_active = true
    LOOP
      -- Log PO line item invoiced_quantity change
      INSERT INTO public.audit_logs (
        entity_type, entity_id, action,
        field_name, old_value, new_value,
        changes_summary,
        changed_by, changed_by_name, changed_at
      ) VALUES (
        'po_line_items',
        po_line_rec.po_line_id,
        'update',
        'invoiced_quantity',
        (po_line_rec.new_invoiced_qty + po_line_rec.voided_qty)::TEXT,
        po_line_rec.new_invoiced_qty::TEXT,
        'Invoiced quantity for "' || COALESCE(po_line_rec.item_name, 'item') ||
          '" decreased from ' ||
          (po_line_rec.new_invoiced_qty + po_line_rec.voided_qty)::TEXT ||
          ' to ' || po_line_rec.new_invoiced_qty::TEXT ||
          ' due to void of invoice ' || NEW.invoice_number,
        voiding_user_id,
        voiding_user_name,
        NOW()
      );

      -- Collect unique PO IDs for status change logging
      IF NOT po_line_rec.po_id = ANY(affected_po_ids) THEN
        affected_po_ids := array_append(affected_po_ids, po_line_rec.po_id);
      END IF;
    END LOOP;

    -- Log PO status changes for each affected PO
    -- The trigger_update_po_status has already recalculated these
    FOR po_rec IN
      SELECT id, po_number, status
      FROM public.purchase_orders
      WHERE id = ANY(affected_po_ids)
    LOOP
      -- Log the PO status recalculation event
      -- Note: We capture the NEW status after cascade; old status was already
      -- changed by the time this trigger fires, but we document the recalculation
      INSERT INTO public.audit_logs (
        entity_type, entity_id, action,
        field_name, new_value,
        changes_summary,
        changed_by, changed_by_name, changed_at
      ) VALUES (
        'purchase_orders',
        po_rec.id,
        'status_change',
        'status',
        po_rec.status::TEXT,
        'PO ' || po_rec.po_number || ' status recalculated to "' ||
          po_rec.status::TEXT || '" due to void of invoice ' || NEW.invoice_number,
        voiding_user_id,
        voiding_user_name,
        NOW()
      );
    END LOOP;

    -- Note: Balance in Hand is NOT changed when invoice is voided.
    -- By design, PO commitment remains unchanged. Balance in Hand tracks
    -- committed funds vs received funds, and voiding an invoice only
    -- affects the invoiced/received quantities, not the PO commitment.

  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger - fires AFTER existing triggers complete (zz_ prefix)
DROP TRIGGER IF EXISTS zz_audit_invoice_void_cascade ON invoices;
CREATE TRIGGER zz_audit_invoice_void_cascade
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION audit_invoice_void_cascade();

-- Comments
COMMENT ON FUNCTION audit_invoice_void_cascade() IS
  'Logs cascade effects when an invoice is voided: PO line item invoiced_quantity changes and PO status recalculations. Uses SECURITY DEFINER with SET search_path for security.';

COMMENT ON TRIGGER zz_audit_invoice_void_cascade ON invoices IS
  'Audit trigger for invoice void cascade effects. Uses zz_ prefix to fire last among AFTER UPDATE triggers (after recalculate and status update triggers complete).';
