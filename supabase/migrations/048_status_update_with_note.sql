-- ============================================
-- Status Update with Note RPC Function
-- ============================================
-- Allows application to update status and create audit entry with note
-- in a single transaction. Prevents duplicate audit entries via trigger
-- deduplication.
-- ============================================

-- Create RPC function for status update with note
CREATE OR REPLACE FUNCTION public.update_status_with_note(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_new_status_id UUID,
  p_note TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status_id UUID;
  v_old_status_name TEXT;
  v_new_status_name TEXT;
  v_user_name TEXT;
  v_table_name TEXT;
BEGIN
  -- Validate entity type
  IF p_entity_type NOT IN ('qmrl', 'qmhq') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid entity type. Must be qmrl or qmhq.'
    );
  END IF;

  -- Determine table name
  v_table_name := p_entity_type;

  -- Get current status
  EXECUTE format('SELECT status_id FROM %I WHERE id = $1', v_table_name)
  INTO v_old_status_id
  USING p_entity_id;

  IF v_old_status_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entity not found'
    );
  END IF;

  -- If status hasn't changed, skip
  IF v_old_status_id = p_new_status_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged'
    );
  END IF;

  -- If note is provided, create audit entry FIRST (before update)
  -- This ensures audit entry exists when trigger checks for duplicates
  IF p_note IS NOT NULL AND p_note != '' THEN
    -- Get status names
    SELECT name INTO v_old_status_name FROM public.status_config WHERE id = v_old_status_id;
    SELECT name INTO v_new_status_name FROM public.status_config WHERE id = p_new_status_id;

    -- Get user name
    SELECT full_name INTO v_user_name FROM public.users WHERE id = p_user_id;

    -- Create audit log entry with note
    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      field_name, old_value, new_value,
      changes_summary, notes,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      v_table_name, p_entity_id, 'status_change',
      'status_id', v_old_status_id::TEXT, p_new_status_id::TEXT,
      'Status changed from "' || COALESCE(v_old_status_name, 'None') ||
        '" to "' || COALESCE(v_new_status_name, 'None') || '"',
      p_note,
      p_user_id, COALESCE(v_user_name, 'Unknown'), NOW()
    );
  END IF;

  -- Update the status (this triggers audit_trigger if no note was provided)
  EXECUTE format('UPDATE %I SET status_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3', v_table_name)
  USING p_new_status_id, p_user_id, p_entity_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Status updated successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.update_status_with_note IS 'Updates entity status with optional note, prevents duplicate audit entries';

-- ============================================
-- Modify Audit Trigger for Deduplication
-- ============================================
-- Add deduplication check in the status_id change block
-- to prevent duplicate audit entries when app creates entry with note
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
  key TEXT;
  old_status_name TEXT;
  new_status_name TEXT;
  old_assignee_name TEXT;
  new_assignee_name TEXT;
  v_recent_audit_exists BOOLEAN;
BEGIN
  -- Convert records to JSONB for safe column access
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_json := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_json := to_jsonb(OLD);
  END IF;

  -- Determine the user making the change
  -- Use auth.uid() as primary, fall back to created_by/updated_by if available
  audit_user_id := auth.uid();

  IF audit_user_id IS NULL THEN
    IF TG_OP = 'INSERT' AND new_json ? 'created_by' THEN
      audit_user_id := (new_json->>'created_by')::UUID;
    ELSIF TG_OP = 'UPDATE' AND new_json ? 'updated_by' THEN
      audit_user_id := (new_json->>'updated_by')::UUID;
    ELSIF TG_OP = 'DELETE' AND old_json ? 'updated_by' THEN
      audit_user_id := (old_json->>'updated_by')::UUID;
    END IF;
  END IF;

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

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN

    -- Check for soft delete (is_active changed to false) - only for tables with is_active
    IF old_json ? 'is_active' AND new_json ? 'is_active' THEN
      IF (old_json->>'is_active')::BOOLEAN = TRUE AND (new_json->>'is_active')::BOOLEAN = FALSE THEN
        audit_action := 'delete';
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
    END IF;

    -- Check for void action (for tables with is_voided)
    IF old_json ? 'is_voided' AND new_json ? 'is_voided' THEN
      IF (old_json->>'is_voided' IS NULL OR (old_json->>'is_voided')::BOOLEAN = FALSE)
         AND (new_json->>'is_voided')::BOOLEAN = TRUE THEN
        audit_action := 'void';
        summary := 'Voided ' || TG_TABLE_NAME;
        IF new_json ? 'void_reason' AND new_json->>'void_reason' IS NOT NULL THEN
          summary := summary || ': ' || (new_json->>'void_reason');
        END IF;

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          old_values, new_values, changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          old_json, new_json, summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for status_id change (qmrl, qmhq only)
    IF old_json ? 'status_id' AND new_json ? 'status_id' THEN
      IF (old_json->>'status_id') IS DISTINCT FROM (new_json->>'status_id') THEN

        -- DEDUPLICATION CHECK: Has audit entry been created in last 2 seconds?
        -- This prevents duplicate entries when app creates audit entry with note via RPC
        SELECT EXISTS(
          SELECT 1 FROM public.audit_logs
          WHERE entity_type = TG_TABLE_NAME
            AND entity_id = NEW.id
            AND action = 'status_change'
            AND field_name = 'status_id'
            AND new_value = (new_json->>'status_id')
            AND changed_at > NOW() - INTERVAL '2 seconds'
        ) INTO v_recent_audit_exists;

        -- If recent audit entry exists, skip creation (app already created it with note)
        IF v_recent_audit_exists THEN
          RETURN NEW;
        END IF;

        -- No recent entry found, create audit log as normal (no note provided)
        audit_action := 'status_change';

        SELECT name INTO old_status_name FROM public.status_config WHERE id = (old_json->>'status_id')::UUID;
        SELECT name INTO new_status_name FROM public.status_config WHERE id = (new_json->>'status_id')::UUID;

        summary := 'Status changed from "' || COALESCE(old_status_name, 'None') ||
                   '" to "' || COALESCE(new_status_name, 'None') || '"';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'status_id', old_json->>'status_id', new_json->>'status_id',
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for PO status change (status enum field on purchase_orders)
    IF TG_TABLE_NAME = 'purchase_orders' AND old_json ? 'status' AND new_json ? 'status' THEN
      IF (old_json->>'status') IS DISTINCT FROM (new_json->>'status') THEN
        audit_action := 'status_change';
        summary := 'PO status changed from "' || COALESCE(old_json->>'status', 'None') ||
                   '" to "' || COALESCE(new_json->>'status', 'None') || '"';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'status', old_json->>'status', new_json->>'status',
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        -- Also check for closure
        IF (new_json->>'status') = 'closed' THEN
          INSERT INTO public.audit_logs (
            entity_type, entity_id, action,
            changes_summary,
            changed_by, changed_by_name, changed_at
          ) VALUES (
            TG_TABLE_NAME, NEW.id, 'close',
            'Purchase order closed',
            audit_user_id, audit_user_name, NOW()
          );
        END IF;

        RETURN NEW;
      END IF;
    END IF;

    -- Check for assignment change (qmrl, qmhq only)
    IF old_json ? 'assigned_to' AND new_json ? 'assigned_to' THEN
      IF (old_json->>'assigned_to') IS DISTINCT FROM (new_json->>'assigned_to') THEN
        audit_action := 'assignment_change';

        SELECT full_name INTO old_assignee_name FROM public.users WHERE id = (old_json->>'assigned_to')::UUID;
        SELECT full_name INTO new_assignee_name FROM public.users WHERE id = (new_json->>'assigned_to')::UUID;

        summary := 'Assignment changed from "' || COALESCE(old_assignee_name, 'Unassigned') ||
                   '" to "' || COALESCE(new_assignee_name, 'Unassigned') || '"';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'assigned_to', old_json->>'assigned_to', new_json->>'assigned_to',
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Check for approval action (purchase_orders only)
    IF TG_TABLE_NAME = 'purchase_orders' AND old_json ? 'approval_status' AND new_json ? 'approval_status' THEN
      IF (old_json->>'approval_status') IS DISTINCT FROM (new_json->>'approval_status')
         AND (new_json->>'approval_status') = 'approved' THEN
        audit_action := 'approve';
        summary := 'Purchase order approved';

        INSERT INTO public.audit_logs (
          entity_type, entity_id, action,
          field_name, old_value, new_value,
          changes_summary,
          changed_by, changed_by_name, changed_at
        ) VALUES (
          TG_TABLE_NAME, NEW.id, audit_action,
          'approval_status', old_json->>'approval_status', new_json->>'approval_status',
          summary,
          audit_user_id, audit_user_name, NOW()
        );

        RETURN NEW;
      END IF;
    END IF;

    -- Generic UPDATE - track all field changes
    audit_action := 'update';

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

  -- Hard DELETE
  IF TG_OP = 'DELETE' THEN
    audit_action := 'delete';
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public;

COMMENT ON FUNCTION public.create_audit_log IS 'Generic audit trigger with deduplication for status changes - safely handles tables with different column schemas using JSONB';
