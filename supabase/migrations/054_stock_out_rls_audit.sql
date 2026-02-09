-- Migration: 054_stock_out_rls_audit.sql
-- Description: Add RLS policies and audit triggers for stock-out request tables
-- Dependencies: 052_stock_out_requests.sql, 027_rls_policies.sql, 026_audit_triggers.sql
-- Phase: 27-stock-out-approval-db-foundation
-- Plan: 27-03

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE stock_out_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Helper: check if user can view a stock-out request
CREATE OR REPLACE FUNCTION public.can_view_sor_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  req_requester_id UUID;
  user_role public.user_role;
BEGIN
  user_role := public.get_user_role();

  -- Admin, quartermaster, and inventory can view all
  IF user_role IN ('admin', 'quartermaster', 'inventory') THEN
    RETURN TRUE;
  END IF;

  -- Others can view only their own requests
  SELECT requester_id INTO req_requester_id
  FROM stock_out_requests
  WHERE id = p_request_id;

  RETURN req_requester_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if user can view an approval (via line item -> request)
CREATE OR REPLACE FUNCTION public.can_view_sor_approval(p_line_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  parent_request_id UUID;
BEGIN
  SELECT request_id INTO parent_request_id
  FROM stock_out_line_items
  WHERE id = p_line_item_id;

  RETURN public.can_view_sor_request(parent_request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STOCK_OUT_REQUESTS RLS POLICIES
-- ============================================================================

-- SELECT: admin, quartermaster, inventory see all; others see own
DROP POLICY IF EXISTS sor_select ON stock_out_requests;
CREATE POLICY sor_select ON stock_out_requests
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
    OR requester_id = auth.uid()
  );

-- INSERT: only admin, quartermaster, inventory can create (per user decision)
DROP POLICY IF EXISTS sor_insert ON stock_out_requests;
CREATE POLICY sor_insert ON stock_out_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- UPDATE: admin can update any; requester can update own (for cancellation)
DROP POLICY IF EXISTS sor_update ON stock_out_requests;
CREATE POLICY sor_update ON stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR requester_id = auth.uid()
  );

-- DELETE: admin only
DROP POLICY IF EXISTS sor_delete ON stock_out_requests;
CREATE POLICY sor_delete ON stock_out_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================================================
-- STOCK_OUT_LINE_ITEMS RLS POLICIES
-- ============================================================================

-- SELECT: visible if user can see parent request
DROP POLICY IF EXISTS sor_li_select ON stock_out_line_items;
CREATE POLICY sor_li_select ON stock_out_line_items
  FOR SELECT USING (
    public.can_view_sor_request(request_id)
  );

-- INSERT: same roles that can create requests
DROP POLICY IF EXISTS sor_li_insert ON stock_out_line_items;
CREATE POLICY sor_li_insert ON stock_out_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- UPDATE: admin and inventory/quartermaster (for status updates via triggers)
DROP POLICY IF EXISTS sor_li_update ON stock_out_line_items;
CREATE POLICY sor_li_update ON stock_out_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- DELETE: admin only
DROP POLICY IF EXISTS sor_li_delete ON stock_out_line_items;
CREATE POLICY sor_li_delete ON stock_out_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================================================
-- STOCK_OUT_APPROVALS RLS POLICIES
-- ============================================================================

-- SELECT: visible if user can see the parent request (via line item)
DROP POLICY IF EXISTS sor_approval_select ON stock_out_approvals;
CREATE POLICY sor_approval_select ON stock_out_approvals
  FOR SELECT USING (
    public.can_view_sor_approval(line_item_id)
  );

-- INSERT: admin only (per user decision: only admin can approve/reject)
DROP POLICY IF EXISTS sor_approval_insert ON stock_out_approvals;
CREATE POLICY sor_approval_insert ON stock_out_approvals
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- UPDATE: admin only
DROP POLICY IF EXISTS sor_approval_update ON stock_out_approvals;
CREATE POLICY sor_approval_update ON stock_out_approvals
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- DELETE: admin only
DROP POLICY IF EXISTS sor_approval_delete ON stock_out_approvals;
CREATE POLICY sor_approval_delete ON stock_out_approvals
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Audit trigger for stock_out_requests
DROP TRIGGER IF EXISTS audit_stock_out_requests ON stock_out_requests;
CREATE TRIGGER audit_stock_out_requests
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- Audit trigger for stock_out_line_items
DROP TRIGGER IF EXISTS audit_stock_out_line_items ON stock_out_line_items;
CREATE TRIGGER audit_stock_out_line_items
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_line_items
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- Audit trigger for stock_out_approvals
DROP TRIGGER IF EXISTS audit_stock_out_approvals ON stock_out_approvals;
CREATE TRIGGER audit_stock_out_approvals
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_approvals
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.can_view_sor_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_sor_approval(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.can_view_sor_request IS 'Check if current user can view a stock-out request (admin/quartermaster/inventory see all, others see own)';
COMMENT ON FUNCTION public.can_view_sor_approval IS 'Check if current user can view a stock-out approval (inherits visibility from parent request)';
