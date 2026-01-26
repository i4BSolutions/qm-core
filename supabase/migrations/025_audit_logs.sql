-- ============================================
-- Iteration 10: Audit Logs Table
-- ============================================
-- Creates the audit_logs table for tracking all changes
-- across the system for compliance and debugging.
-- ============================================

-- Create audit action enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE public.audit_action AS ENUM (
      'create',
      'update',
      'delete',
      'status_change',
      'assignment_change',
      'void',
      'approve',
      'close',
      'cancel'
    );
  END IF;
END$$;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity identification
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Action tracking
  action public.audit_action NOT NULL,

  -- Field-level change tracking (for single field updates)
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,

  -- Full record change tracking (for complex updates)
  old_values JSONB,
  new_values JSONB,

  -- Human-readable summary
  changes_summary TEXT,

  -- Who made the change
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,  -- Cached name for display

  -- When the change happened
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Additional context
  notes TEXT
);

-- Add table comment
COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all entity changes across the system';

-- Add column comments
COMMENT ON COLUMN public.audit_logs.entity_type IS 'Type of entity: users, qmrl, qmhq, items, warehouses, etc.';
COMMENT ON COLUMN public.audit_logs.entity_id IS 'UUID of the entity being tracked';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action: create, update, delete, status_change, etc.';
COMMENT ON COLUMN public.audit_logs.field_name IS 'Name of the specific field changed (for single-field updates)';
COMMENT ON COLUMN public.audit_logs.old_value IS 'Previous value of the field (text representation)';
COMMENT ON COLUMN public.audit_logs.new_value IS 'New value of the field (text representation)';
COMMENT ON COLUMN public.audit_logs.old_values IS 'Complete previous state as JSONB (for multi-field updates)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'Complete new state as JSONB (for multi-field updates)';
COMMENT ON COLUMN public.audit_logs.changes_summary IS 'Human-readable summary of changes';
COMMENT ON COLUMN public.audit_logs.changed_by IS 'User who made the change';
COMMENT ON COLUMN public.audit_logs.changed_by_name IS 'Cached user name for display without joins';
COMMENT ON COLUMN public.audit_logs.changed_at IS 'Timestamp when the change occurred';
COMMENT ON COLUMN public.audit_logs.notes IS 'Optional notes or context about the change';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON public.audit_logs(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by
  ON public.audit_logs(changed_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_time
  ON public.audit_logs(entity_type, entity_id, changed_at DESC);

-- ============================================
-- Helper function to get user name for audit
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_name_for_audit(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_name TEXT;
BEGIN
  SELECT full_name INTO user_name
  FROM public.users
  WHERE id = user_id;

  RETURN COALESCE(user_name, 'Unknown User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_name_for_audit IS 'Helper function to get user name for audit log entries';

-- Grant permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
