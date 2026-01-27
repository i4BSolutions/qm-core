-- ============================================
-- Fix Audit Trigger: Handle tables without created_by
-- ============================================
-- Some tables (po_line_items, invoice_line_items) don't have
-- created_by column. The audit trigger must handle this gracefully.
-- ============================================

CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  audit_action public.audit_action;
  audit_user_id UUID;
  audit_user_name TEXT;
  changes_json JSONB;
  old_json JSONB;
  new_json JSONB;
  summary TEXT;
  field_changed TEXT;
  old_val TEXT;
  new_val TEXT;
  key TEXT;
BEGIN
  -- Determine the user making the change
  -- Use auth.uid() as primary source, fall back to created_by/updated_by only for tables that have them
  audit_user_id := COALESCE(
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' AND TG_TABLE_NAME IN (
        'users', 'departments', 'status_config', 'categories', 'contact_persons',
        'suppliers', 'items', 'warehouses', 'qmrl', 'qmhq', 'financial_transactions',
        'purchase_orders', 'invoices', 'inventory_transactions'
      ) THEN (to_jsonb(NEW)->>'created_by')::UUID
      WHEN TG_OP = 'UPDATE' AND TG_TABLE_NAME IN (
        'users', 'departments', 'status_config', 'categories', 'contact_persons',
        'suppliers', 'items', 'warehouses', 'qmrl', 'qmhq', 'financial_transactions',
        'purchase_orders', 'invoices', 'inventory_transactions'
      ) THEN (to_jsonb(NEW)->>'updated_by')::UUID
      WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME IN (
        'users', 'departments', 'status_config', 'categories', 'contact_persons',
        'suppliers', 'items', 'warehouses', 'qmrl', 'qmhq', 'financial_transactions',
        'purchase_orders', 'invoices', 'inventory_transactions'
      ) THEN (to_jsonb(OLD)->>'updated_by')::UUID
      ELSE NULL
    END
  );

  -- Get user name
  IF audit_user_id IS NOT NULL THEN
    SELECT full_name INTO audit_user_name
    FROM public.users
    WHERE id = audit_user_id;
  END IF;
  audit_user_name := COALESCE(audit_user_name, 'System');

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    audit_action := 'create';
    new_json := to_jsonb(NEW);
    summary := 'Created new ' || TG_TABLE_NAME;

    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      new_values, changes_summary,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      TG_TABLE_NAME, NEW.id, audit_action,
      new_json, summary,
      audit_user_id, audit_user_name, NOW()
    );

    RETURN NEW;
  END IF;

  -- Handle DELETE (soft delete detection)
  IF TG_OP = 'UPDATE' THEN
    -- Check for soft delete (is_active changed to false)
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      audit_action := 'delete';
      old_json := to_jsonb(OLD);
      summary := 'Soft deleted ' || TG_TABLE_NAME;

      INSERT INTO public.audit_logs (
        entity_type, entity_id, action,
        old_values, changes_summary,
        changed_by, changed_by_name, changed_at
      ) VALUES (
        TG_TABLE_NAME, NEW.id, audit_action,
        old_json, summary,
        audit_user_id, audit_user_name, NOW()
      );

      RETURN NEW;
    END IF;

    -- Check for void action (for invoices, financial_transactions)
    IF TG_TABLE_NAME IN ('invoices', 'financial_transactions') THEN
      IF (OLD.is_voided IS NULL OR OLD.is_voided = FALSE) AND NEW.is_voided = TRUE THEN
        audit_action := 'void';
        summary := 'Voided ' || TG_TABLE_NAME;
        IF NEW.void_reason IS NOT NULL THEN
          summary := summary || ': ' || NEW.void_reason;
        END IF;

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          old_values, new_values, changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          to_jsonb(OLD), to_jsonb(NEW), summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for status change
    IF TG_TABLE_NAME IN ('qmrl', 'qmhq', 'purchase_orders', 'invoices') THEN
      -- For tables with status_id
      IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        audit_action := 'status_change';

        -- Get status names for summary
        DECLARE
          old_status_name TEXT;
          new_status_name TEXT;
        BEGIN
          SELECT name INTO old_status_name FROM public.status_config WHERE id = OLD.status_id;
          SELECT name INTO new_status_name FROM public.status_config WHERE id = NEW.status_id;

          summary := 'Status changed from "' || COALESCE(old_status_name, 'None') ||
                     '" to "' || COALESCE(new_status_name, 'None') || '"';
        END;

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'status_id', OLD.status_id::TEXT, NEW.status_id::TEXT,
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for PO status change (status enum field)
    IF TG_TABLE_NAME = 'purchase_orders' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        audit_action := 'status_change';
        summary := 'PO status changed from "' || COALESCE(OLD.status::TEXT, 'None') ||
                   '" to "' || COALESCE(NEW.status::TEXT, 'None') || '"';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'status', OLD.status::TEXT, NEW.status::TEXT,
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;

      -- Check for PO closure
      IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
        audit_action := 'close';
        summary := 'Purchase order closed';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          summary,
          audit_user_id, audit_user_name, NOW()
        );
      END IF;
    END IF;

    -- Check for assignment change
    IF TG_TABLE_NAME IN ('qmrl', 'qmhq') THEN
      IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        audit_action := 'assignment_change';

        DECLARE
          old_assignee_name TEXT;
          new_assignee_name TEXT;
        BEGIN
          SELECT full_name INTO old_assignee_name FROM public.users WHERE id = OLD.assigned_to;
          SELECT full_name INTO new_assignee_name FROM public.users WHERE id = NEW.assigned_to;

          summary := 'Assignment changed from "' || COALESCE(old_assignee_name, 'Unassigned') ||
                     '" to "' || COALESCE(new_assignee_name, 'Unassigned') || '"';
        END;

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT,
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for approval action
    IF TG_TABLE_NAME = 'purchase_orders' THEN
      IF OLD.approval_status IS DISTINCT FROM NEW.approval_status AND NEW.approval_status = 'approved' THEN
        audit_action := 'approve';
        summary := 'Purchase order approved';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'approval_status', OLD.approval_status::TEXT, NEW.approval_status::TEXT,
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Generic UPDATE - track all field changes
    audit_action := 'update';
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);

    -- Build changes JSON (only changed fields)
    changes_json := '{}';
    FOR key IN SELECT jsonb_object_keys(new_json)
    LOOP
      -- Skip audit fields and unchanged values
      IF key NOT IN ('updated_at', 'updated_by', 'created_at', 'created_by') THEN
        IF (old_json->key) IS DISTINCT FROM (new_json->key) THEN
          changes_json := changes_json || jsonb_build_object(
            key, jsonb_build_object(
              'old', old_json->key,
              'new', new_json->key
            )
          );
        END IF;
      END IF;
    END LOOP;

    -- Only log if there are meaningful changes
    IF changes_json != '{}' THEN
      -- Build summary
      summary := 'Updated ' || TG_TABLE_NAME;

      INSERT INTO public.audit_logs (
        entity_type, entity_id, action,
        old_values, new_values, changes_summary,
        changed_by, changed_by_name, changed_at
      ) VALUES (
        TG_TABLE_NAME, NEW.id, audit_action,
        changes_json, NULL, summary,
        audit_user_id, audit_user_name, NOW()
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Hard DELETE (should be rare with soft delete pattern)
  IF TG_OP = 'DELETE' THEN
    audit_action := 'delete';
    old_json := to_jsonb(OLD);
    summary := 'Hard deleted ' || TG_TABLE_NAME;

    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      old_values, changes_summary,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      TG_TABLE_NAME, OLD.id, audit_action,
      old_json, summary,
      audit_user_id, audit_user_name, NOW()
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_audit_log IS 'Generic audit trigger function - handles tables with or without created_by column';
