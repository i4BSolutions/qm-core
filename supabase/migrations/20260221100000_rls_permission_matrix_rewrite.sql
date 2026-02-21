-- Migration: 20260221100000_rls_permission_matrix_rewrite.sql
-- Phase: 60 - RLS Policy Rewrite
-- Description: Replace all 100+ existing RLS policies with permission-matrix-aware
--              policies using has_permission(), drop legacy role infrastructure.
--
-- After this migration:
--   - Edit = INSERT + UPDATE + SELECT + DELETE for that resource
--   - View  = SELECT only for that resource
--   - Block = no rows returned, mutations denied
--   - No RLS policy references get_user_role() — all use has_permission()
--   - users.role column and user_role enum are dropped
--
-- Dependencies:
--   - 20260221000000_permission_schema.sql (defines has_permission(), user_permissions table)
--
-- Date: 2026-02-21

BEGIN;

-- ============================================
-- SECTION A: Drop ALL existing RLS policies
-- ============================================

-- users table
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_select_all_authenticated ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- departments table
DROP POLICY IF EXISTS departments_select ON public.departments;
DROP POLICY IF EXISTS departments_insert ON public.departments;
DROP POLICY IF EXISTS departments_update ON public.departments;
DROP POLICY IF EXISTS departments_delete ON public.departments;

-- status_config table
DROP POLICY IF EXISTS status_config_select ON public.status_config;
DROP POLICY IF EXISTS status_config_insert ON public.status_config;
DROP POLICY IF EXISTS status_config_update ON public.status_config;
DROP POLICY IF EXISTS status_config_delete ON public.status_config;

-- categories table
DROP POLICY IF EXISTS categories_select ON public.categories;
DROP POLICY IF EXISTS categories_insert ON public.categories;
DROP POLICY IF EXISTS categories_update ON public.categories;
DROP POLICY IF EXISTS categories_delete ON public.categories;

-- contact_persons table
DROP POLICY IF EXISTS contact_persons_select ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_insert ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_update ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_delete ON public.contact_persons;

-- suppliers table
DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

-- items table
DROP POLICY IF EXISTS items_select ON public.items;
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_delete ON public.items;

-- warehouses table
DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

-- qmrl table
DROP POLICY IF EXISTS qmrl_select ON public.qmrl;
DROP POLICY IF EXISTS qmrl_insert ON public.qmrl;
DROP POLICY IF EXISTS qmrl_update ON public.qmrl;
DROP POLICY IF EXISTS qmrl_delete ON public.qmrl;

-- qmhq table
DROP POLICY IF EXISTS qmhq_select ON public.qmhq;
DROP POLICY IF EXISTS qmhq_insert ON public.qmhq;
DROP POLICY IF EXISTS qmhq_update ON public.qmhq;
DROP POLICY IF EXISTS qmhq_delete ON public.qmhq;

-- financial_transactions table
DROP POLICY IF EXISTS financial_transactions_select ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_insert ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete ON public.financial_transactions;

-- purchase_orders table
DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;

-- po_line_items table
DROP POLICY IF EXISTS po_line_items_select ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_insert ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_update ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_delete ON public.po_line_items;

-- invoices table
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

-- invoice_line_items table
DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;

-- inventory_transactions table
DROP POLICY IF EXISTS inventory_transactions_select ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;

-- audit_logs table
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

-- file_attachments table
DROP POLICY IF EXISTS file_attachments_select ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_insert ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_delete ON public.file_attachments;

-- comments table
DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;

-- stock_out_requests table
DROP POLICY IF EXISTS sor_select ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_insert ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_update ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_delete ON public.stock_out_requests;

-- stock_out_line_items table
DROP POLICY IF EXISTS sor_li_select ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_insert ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_update ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_delete ON public.stock_out_line_items;

-- stock_out_approvals table
DROP POLICY IF EXISTS sor_approval_select ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_insert ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_update ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_delete ON public.stock_out_approvals;

-- qmhq_items table
DROP POLICY IF EXISTS qmhq_items_select ON public.qmhq_items;
DROP POLICY IF EXISTS qmhq_items_insert ON public.qmhq_items;
DROP POLICY IF EXISTS qmhq_items_update ON public.qmhq_items;
DROP POLICY IF EXISTS qmhq_items_delete ON public.qmhq_items;

-- standard_units table
DROP POLICY IF EXISTS standard_units_select ON public.standard_units;
DROP POLICY IF EXISTS standard_units_insert ON public.standard_units;
DROP POLICY IF EXISTS standard_units_update ON public.standard_units;
DROP POLICY IF EXISTS standard_units_delete ON public.standard_units;

-- system_config table (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_config') THEN
    EXECUTE 'DROP POLICY IF EXISTS system_config_select ON public.system_config';
    EXECUTE 'DROP POLICY IF EXISTS system_config_insert ON public.system_config';
    EXECUTE 'DROP POLICY IF EXISTS system_config_update ON public.system_config';
    EXECUTE 'DROP POLICY IF EXISTS system_config_delete ON public.system_config';
  END IF;
END $$;

-- user_permissions table
DROP POLICY IF EXISTS admin_full_access_permissions ON public.user_permissions;
DROP POLICY IF EXISTS users_read_own_permissions ON public.user_permissions;

-- storage.objects policies
DROP POLICY IF EXISTS storage_attachments_select ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_update ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_delete ON storage.objects;


-- ============================================
-- SECTION B: Create fresh permission-matrix policies
-- ============================================

-- ============================================
-- B.1: users table — controlled by 'admin' resource
-- SELECT: all authenticated users can read (collaboration features)
-- INSERT/DELETE: admin only
-- UPDATE: admin or own profile
-- ============================================

CREATE POLICY users_perm_select ON public.users
  FOR SELECT USING (true);

CREATE POLICY users_perm_insert ON public.users
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY users_perm_update ON public.users
  FOR UPDATE USING (has_permission('admin', 'edit') OR id = auth.uid());

CREATE POLICY users_perm_delete ON public.users
  FOR DELETE USING (has_permission('admin', 'edit'));


-- ============================================
-- B.2: user_permissions table — admin-only (all four operations)
-- NOTE: Direct subquery used (NOT has_permission()) to avoid circular dependency:
--   has_permission() reads from user_permissions → policy on user_permissions
--   calling has_permission() would recurse infinitely.
-- ============================================

CREATE POLICY user_permissions_perm_select ON public.user_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'admin'
        AND up.level = 'edit'
    )
  );

CREATE POLICY user_permissions_perm_insert ON public.user_permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'admin'
        AND up.level = 'edit'
    )
  );

CREATE POLICY user_permissions_perm_update ON public.user_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'admin'
        AND up.level = 'edit'
    )
  );

CREATE POLICY user_permissions_perm_delete ON public.user_permissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'admin'
        AND up.level = 'edit'
    )
  );


-- ============================================
-- B.3: Reference/config tables — universally readable, admin-writable
-- departments, status_config, categories, contact_persons, suppliers,
-- standard_units, system_config (if exists)
-- ============================================

-- departments
CREATE POLICY departments_perm_select ON public.departments
  FOR SELECT USING (true);

CREATE POLICY departments_perm_insert ON public.departments
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY departments_perm_update ON public.departments
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY departments_perm_delete ON public.departments
  FOR DELETE USING (has_permission('admin', 'edit'));

-- status_config
CREATE POLICY status_config_perm_select ON public.status_config
  FOR SELECT USING (true);

CREATE POLICY status_config_perm_insert ON public.status_config
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY status_config_perm_update ON public.status_config
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY status_config_perm_delete ON public.status_config
  FOR DELETE USING (has_permission('admin', 'edit'));

-- categories
CREATE POLICY categories_perm_select ON public.categories
  FOR SELECT USING (true);

CREATE POLICY categories_perm_insert ON public.categories
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY categories_perm_update ON public.categories
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY categories_perm_delete ON public.categories
  FOR DELETE USING (has_permission('admin', 'edit'));

-- contact_persons
CREATE POLICY contact_persons_perm_select ON public.contact_persons
  FOR SELECT USING (true);

CREATE POLICY contact_persons_perm_insert ON public.contact_persons
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY contact_persons_perm_update ON public.contact_persons
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY contact_persons_perm_delete ON public.contact_persons
  FOR DELETE USING (has_permission('admin', 'edit'));

-- suppliers
CREATE POLICY suppliers_perm_select ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY suppliers_perm_insert ON public.suppliers
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY suppliers_perm_update ON public.suppliers
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY suppliers_perm_delete ON public.suppliers
  FOR DELETE USING (has_permission('admin', 'edit'));

-- standard_units
CREATE POLICY standard_units_perm_select ON public.standard_units
  FOR SELECT USING (true);

CREATE POLICY standard_units_perm_insert ON public.standard_units
  FOR INSERT WITH CHECK (has_permission('admin', 'edit'));

CREATE POLICY standard_units_perm_update ON public.standard_units
  FOR UPDATE USING (has_permission('admin', 'edit'));

CREATE POLICY standard_units_perm_delete ON public.standard_units
  FOR DELETE USING (has_permission('admin', 'edit'));

-- system_config (if table exists — created in earlier migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_config'
  ) THEN
    EXECUTE 'CREATE POLICY system_config_perm_select ON public.system_config FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY system_config_perm_insert ON public.system_config FOR INSERT WITH CHECK (has_permission(''admin'', ''edit''))';
    EXECUTE 'CREATE POLICY system_config_perm_update ON public.system_config FOR UPDATE USING (has_permission(''admin'', ''edit''))';
    EXECUTE 'CREATE POLICY system_config_perm_delete ON public.system_config FOR DELETE USING (has_permission(''admin'', ''edit''))';
  END IF;
END;
$$;


-- ============================================
-- B.4: Resource-mapped tables — standard Edit/View pattern
-- Edit (level='edit') = SELECT + INSERT + UPDATE + DELETE
-- View (level='view')  = SELECT only
-- Block               = nothing (has_permission returns false for both)
-- ============================================

-- qmrl → resource 'qmrl'
CREATE POLICY qmrl_perm_select ON public.qmrl
  FOR SELECT USING (has_permission('qmrl', 'view'));

CREATE POLICY qmrl_perm_insert ON public.qmrl
  FOR INSERT WITH CHECK (has_permission('qmrl', 'edit'));

CREATE POLICY qmrl_perm_update ON public.qmrl
  FOR UPDATE USING (has_permission('qmrl', 'edit'));

CREATE POLICY qmrl_perm_delete ON public.qmrl
  FOR DELETE USING (has_permission('qmrl', 'edit'));

-- qmhq → resource 'qmhq'
CREATE POLICY qmhq_perm_select ON public.qmhq
  FOR SELECT USING (has_permission('qmhq', 'view'));

CREATE POLICY qmhq_perm_insert ON public.qmhq
  FOR INSERT WITH CHECK (has_permission('qmhq', 'edit'));

CREATE POLICY qmhq_perm_update ON public.qmhq
  FOR UPDATE USING (has_permission('qmhq', 'edit'));

CREATE POLICY qmhq_perm_delete ON public.qmhq
  FOR DELETE USING (has_permission('qmhq', 'edit'));

-- qmhq_items → resource 'qmhq' (child inherits parent)
CREATE POLICY qmhq_items_perm_select ON public.qmhq_items
  FOR SELECT USING (has_permission('qmhq', 'view'));

CREATE POLICY qmhq_items_perm_insert ON public.qmhq_items
  FOR INSERT WITH CHECK (has_permission('qmhq', 'edit'));

CREATE POLICY qmhq_items_perm_update ON public.qmhq_items
  FOR UPDATE USING (has_permission('qmhq', 'edit'));

CREATE POLICY qmhq_items_perm_delete ON public.qmhq_items
  FOR DELETE USING (has_permission('qmhq', 'edit'));

-- financial_transactions → resource 'money_transactions'
CREATE POLICY financial_transactions_perm_select ON public.financial_transactions
  FOR SELECT USING (has_permission('money_transactions', 'view'));

CREATE POLICY financial_transactions_perm_insert ON public.financial_transactions
  FOR INSERT WITH CHECK (has_permission('money_transactions', 'edit'));

CREATE POLICY financial_transactions_perm_update ON public.financial_transactions
  FOR UPDATE USING (has_permission('money_transactions', 'edit'));

CREATE POLICY financial_transactions_perm_delete ON public.financial_transactions
  FOR DELETE USING (has_permission('money_transactions', 'edit'));

-- purchase_orders → resource 'po'
CREATE POLICY purchase_orders_perm_select ON public.purchase_orders
  FOR SELECT USING (has_permission('po', 'view'));

CREATE POLICY purchase_orders_perm_insert ON public.purchase_orders
  FOR INSERT WITH CHECK (has_permission('po', 'edit'));

CREATE POLICY purchase_orders_perm_update ON public.purchase_orders
  FOR UPDATE USING (has_permission('po', 'edit'));

CREATE POLICY purchase_orders_perm_delete ON public.purchase_orders
  FOR DELETE USING (has_permission('po', 'edit'));

-- po_line_items → resource 'po' (child inherits parent)
CREATE POLICY po_line_items_perm_select ON public.po_line_items
  FOR SELECT USING (has_permission('po', 'view'));

CREATE POLICY po_line_items_perm_insert ON public.po_line_items
  FOR INSERT WITH CHECK (has_permission('po', 'edit'));

CREATE POLICY po_line_items_perm_update ON public.po_line_items
  FOR UPDATE USING (has_permission('po', 'edit'));

CREATE POLICY po_line_items_perm_delete ON public.po_line_items
  FOR DELETE USING (has_permission('po', 'edit'));

-- invoices → resource 'invoice'
CREATE POLICY invoices_perm_select ON public.invoices
  FOR SELECT USING (has_permission('invoice', 'view'));

CREATE POLICY invoices_perm_insert ON public.invoices
  FOR INSERT WITH CHECK (has_permission('invoice', 'edit'));

CREATE POLICY invoices_perm_update ON public.invoices
  FOR UPDATE USING (has_permission('invoice', 'edit'));

CREATE POLICY invoices_perm_delete ON public.invoices
  FOR DELETE USING (has_permission('invoice', 'edit'));

-- invoice_line_items → resource 'invoice' (child inherits parent)
CREATE POLICY invoice_line_items_perm_select ON public.invoice_line_items
  FOR SELECT USING (has_permission('invoice', 'view'));

CREATE POLICY invoice_line_items_perm_insert ON public.invoice_line_items
  FOR INSERT WITH CHECK (has_permission('invoice', 'edit'));

CREATE POLICY invoice_line_items_perm_update ON public.invoice_line_items
  FOR UPDATE USING (has_permission('invoice', 'edit'));

CREATE POLICY invoice_line_items_perm_delete ON public.invoice_line_items
  FOR DELETE USING (has_permission('invoice', 'edit'));

-- inventory_transactions → resource 'inv_transactions'
CREATE POLICY inventory_transactions_perm_select ON public.inventory_transactions
  FOR SELECT USING (has_permission('inv_transactions', 'view'));

CREATE POLICY inventory_transactions_perm_insert ON public.inventory_transactions
  FOR INSERT WITH CHECK (has_permission('inv_transactions', 'edit'));

CREATE POLICY inventory_transactions_perm_update ON public.inventory_transactions
  FOR UPDATE USING (has_permission('inv_transactions', 'edit'));

CREATE POLICY inventory_transactions_perm_delete ON public.inventory_transactions
  FOR DELETE USING (has_permission('inv_transactions', 'edit'));

-- stock_out_requests → resource 'sor'
CREATE POLICY sor_perm_select ON public.stock_out_requests
  FOR SELECT USING (has_permission('sor', 'view'));

CREATE POLICY sor_perm_insert ON public.stock_out_requests
  FOR INSERT WITH CHECK (has_permission('sor', 'edit'));

CREATE POLICY sor_perm_update ON public.stock_out_requests
  FOR UPDATE USING (has_permission('sor', 'edit'));

CREATE POLICY sor_perm_delete ON public.stock_out_requests
  FOR DELETE USING (has_permission('sor', 'edit'));

-- stock_out_line_items → resource 'sor' (child inherits parent)
CREATE POLICY sor_li_perm_select ON public.stock_out_line_items
  FOR SELECT USING (has_permission('sor', 'view'));

CREATE POLICY sor_li_perm_insert ON public.stock_out_line_items
  FOR INSERT WITH CHECK (has_permission('sor', 'edit'));

CREATE POLICY sor_li_perm_update ON public.stock_out_line_items
  FOR UPDATE USING (has_permission('sor', 'edit'));

CREATE POLICY sor_li_perm_delete ON public.stock_out_line_items
  FOR DELETE USING (has_permission('sor', 'edit'));

-- items → resource 'item'
CREATE POLICY items_perm_select ON public.items
  FOR SELECT USING (has_permission('item', 'view'));

CREATE POLICY items_perm_insert ON public.items
  FOR INSERT WITH CHECK (has_permission('item', 'edit'));

CREATE POLICY items_perm_update ON public.items
  FOR UPDATE USING (has_permission('item', 'edit'));

CREATE POLICY items_perm_delete ON public.items
  FOR DELETE USING (has_permission('item', 'edit'));

-- warehouses → resource 'warehouse'
CREATE POLICY warehouses_perm_select ON public.warehouses
  FOR SELECT USING (has_permission('warehouse', 'view'));

CREATE POLICY warehouses_perm_insert ON public.warehouses
  FOR INSERT WITH CHECK (has_permission('warehouse', 'edit'));

CREATE POLICY warehouses_perm_update ON public.warehouses
  FOR UPDATE USING (has_permission('warehouse', 'edit'));

CREATE POLICY warehouses_perm_delete ON public.warehouses
  FOR DELETE USING (has_permission('warehouse', 'edit'));


-- ============================================
-- B.5: stock_out_approvals — layer-specific permissions
-- View on ANY approval layer allows seeing approvals.
-- Edit on ANY approval layer allows creating/updating (trigger enforces which layer).
-- Delete is admin-only.
-- ============================================

CREATE POLICY sor_approval_perm_select ON public.stock_out_approvals
  FOR SELECT USING (
    has_permission('sor_l1', 'view')
    OR has_permission('sor_l2', 'view')
    OR has_permission('sor_l3', 'view')
  );

CREATE POLICY sor_approval_perm_insert ON public.stock_out_approvals
  FOR INSERT WITH CHECK (
    has_permission('sor_l1', 'edit')
    OR has_permission('sor_l2', 'edit')
    OR has_permission('sor_l3', 'edit')
  );

CREATE POLICY sor_approval_perm_update ON public.stock_out_approvals
  FOR UPDATE USING (
    has_permission('sor_l1', 'edit')
    OR has_permission('sor_l2', 'edit')
    OR has_permission('sor_l3', 'edit')
  );

CREATE POLICY sor_approval_perm_delete ON public.stock_out_approvals
  FOR DELETE USING (has_permission('admin', 'edit'));


-- ============================================
-- B.6: audit_logs — universally readable, triggers control inserts
-- ============================================

CREATE POLICY audit_logs_perm_select ON public.audit_logs
  FOR SELECT USING (true);

CREATE POLICY audit_logs_perm_insert ON public.audit_logs
  FOR INSERT WITH CHECK (true);


-- ============================================
-- B.7: Cross-cutting tables — inherit parent entity permission
-- Helper functions map entity_type text to permission_resource enum.
-- ============================================

-- Helper: map file attachment entity_type to permission_resource
CREATE OR REPLACE FUNCTION public.attachment_entity_resource(p_entity_type TEXT)
RETURNS public.permission_resource AS $$
BEGIN
  RETURN CASE p_entity_type
    WHEN 'qmrl' THEN 'qmrl'::public.permission_resource
    WHEN 'qmhq' THEN 'qmhq'::public.permission_resource
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.attachment_entity_resource IS
  'Maps file_attachments.entity_type text to permission_resource enum. '
  'Returns NULL for unknown entity types (which will block access).';

-- Helper: map comment entity_type to permission_resource
CREATE OR REPLACE FUNCTION public.comment_entity_resource(p_entity_type TEXT)
RETURNS public.permission_resource AS $$
BEGIN
  RETURN CASE p_entity_type
    WHEN 'qmrl'    THEN 'qmrl'::public.permission_resource
    WHEN 'qmhq'    THEN 'qmhq'::public.permission_resource
    WHEN 'po'      THEN 'po'::public.permission_resource
    WHEN 'invoice' THEN 'invoice'::public.permission_resource
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.comment_entity_resource IS
  'Maps comments.entity_type text to permission_resource enum. '
  'Returns NULL for unknown entity types (which will block access).';

-- file_attachments policies — check parent entity permission
CREATE POLICY file_attachments_perm_select ON public.file_attachments
  FOR SELECT USING (
    deleted_at IS NULL
    AND has_permission(attachment_entity_resource(entity_type), 'view')
  );

CREATE POLICY file_attachments_perm_insert ON public.file_attachments
  FOR INSERT WITH CHECK (
    has_permission(attachment_entity_resource(entity_type), 'edit')
  );

CREATE POLICY file_attachments_perm_update ON public.file_attachments
  FOR UPDATE USING (
    (has_permission('admin', 'edit') OR uploaded_by = auth.uid())
    AND has_permission(attachment_entity_resource(entity_type), 'view')
  );

CREATE POLICY file_attachments_perm_delete ON public.file_attachments
  FOR DELETE USING (has_permission('admin', 'edit'));

-- comments policies — check parent entity permission
CREATE POLICY comments_perm_select ON public.comments
  FOR SELECT USING (
    deleted_at IS NULL
    AND has_permission(comment_entity_resource(entity_type), 'view')
  );

-- Commenting requires at least view permission on the parent entity
CREATE POLICY comments_perm_insert ON public.comments
  FOR INSERT WITH CHECK (
    has_permission(comment_entity_resource(entity_type), 'view')
  );

-- Users can edit their own comments (no replies) if they still have view permission
CREATE POLICY comments_perm_update ON public.comments
  FOR UPDATE USING (
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
    AND has_permission(comment_entity_resource(entity_type), 'view')
  );

-- Hard delete: admin only
CREATE POLICY comments_perm_delete ON public.comments
  FOR DELETE USING (has_permission('admin', 'edit'));


-- ============================================
-- B.8: storage.objects — attachments bucket
-- ============================================

-- SELECT: Download if file record exists in file_attachments and is not deleted
-- (The file_attachments SELECT policy ensures the user can see the record;
--  this storage policy mirrors that check without re-running permission logic)
CREATE POLICY storage_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.file_attachments fa
      WHERE fa.storage_path = name
        AND fa.deleted_at IS NULL
    )
  );

-- INSERT: Any authenticated user can upload to the attachments bucket
-- (file_attachments INSERT policy enforces entity permission on the metadata record)
CREATE POLICY storage_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- UPDATE: Admin only
CREATE POLICY storage_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND has_permission('admin', 'edit'));

-- DELETE: Admin only
CREATE POLICY storage_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND has_permission('admin', 'edit'));


-- ============================================
-- SECTION C: Update helper functions
-- Replace get_user_role() references with permission checks.
-- ============================================

-- C.1: Update can_view_sor_request()
-- Old: checked get_user_role() IN ('admin', 'qmhq')
-- New: check has_permission('sor', 'view') — uniform with RLS policy above
CREATE OR REPLACE FUNCTION public.can_view_sor_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Users with SOR view permission can see all requests
  IF has_permission('sor', 'view') THEN
    RETURN TRUE;
  END IF;
  -- Others can view only their own requests (no access if sor is blocked)
  RETURN EXISTS (
    SELECT 1 FROM public.stock_out_requests
    WHERE id = p_request_id AND requester_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.can_view_sor_request IS
  'Returns true if the current user can view the given SOR request. '
  'Users with sor view permission see all requests; others see only their own. '
  'Updated in Phase 60 to use has_permission() instead of get_user_role().';

-- C.2: Drop can_view_sor_approval() — no longer needed.
-- New stock_out_approvals SELECT policy uses has_permission(sor_lN, view) directly.
DROP FUNCTION IF EXISTS public.can_view_sor_approval(UUID);

-- C.3: Drop owns_qmrl() — no longer needed.
-- Old own-records pattern removed; View = read ALL records.
DROP FUNCTION IF EXISTS public.owns_qmrl(UUID);

-- C.4: Update delete_file_attachment()
-- Old: selected role::TEXT from users, compared to 'admin'/'qmhq'/'qmrl'
-- New: use check_user_permission(p_user_id, resource) for permission-based checks
CREATE OR REPLACE FUNCTION public.delete_file_attachment(
  p_file_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_file RECORD;
  v_can_delete BOOLEAN := FALSE;
  v_admin_level public.permission_level;
BEGIN
  -- Get file info
  SELECT id, entity_type, entity_id, uploaded_by, storage_path
  INTO v_file
  FROM public.file_attachments
  WHERE id = p_file_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'File not found');
  END IF;

  -- Check authorization:
  -- 1. Admin (admin permission = edit) can delete any file
  IF check_user_permission(p_user_id, 'admin') = 'edit' THEN
    v_can_delete := TRUE;
  -- 2. Original uploader can delete their own file
  ELSIF v_file.uploaded_by = p_user_id THEN
    v_can_delete := TRUE;
  -- 3. Users with edit permission on the parent entity can delete files on that entity
  ELSIF v_file.entity_type = 'qmrl' THEN
    -- QMRL edit permission = can manage QMRL attachments
    v_can_delete := (check_user_permission(p_user_id, 'qmrl') = 'edit');
  ELSIF v_file.entity_type = 'qmhq' THEN
    -- QMHQ edit permission = can manage QMHQ attachments
    v_can_delete := (check_user_permission(p_user_id, 'qmhq') = 'edit');
  END IF;

  IF NOT v_can_delete THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Hard delete from database
  DELETE FROM public.file_attachments WHERE id = p_file_id;

  RETURN json_build_object(
    'success', true,
    'entity_type', v_file.entity_type,
    'entity_id', v_file.entity_id,
    'storage_path', v_file.storage_path
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.delete_file_attachment IS
  'Hard-deletes a file attachment after permission check. '
  'Admin (admin=edit) can delete any file. '
  'Original uploader can delete own file. '
  'Users with edit permission on the parent entity (qmrl/qmhq) can delete. '
  'Updated in Phase 60 to use check_user_permission() instead of role column.';


-- ============================================
-- SECTION D: Update handle_new_user() and drop legacy role infrastructure
-- ============================================

-- D.1: Update handle_new_user() BEFORE dropping the role column.
-- Remove 'role' from the INSERT statement.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  -- Seed all 16 resources as Block — admin must explicitly grant permissions
  PERFORM public.create_default_permissions(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Trigger function: creates public.users profile and seeds 16 Block permission rows '
  'for every new auth.users signup. '
  'Updated in Phase 60: role column removed from INSERT (column being dropped).';

-- D.2: Drop get_user_role() — no longer needed after RLS rewrite
DROP FUNCTION IF EXISTS public.get_user_role();

-- D.3: Drop has_role() — legacy function, superseded by has_permission()
DROP FUNCTION IF EXISTS public.has_role(public.user_role);
DROP FUNCTION IF EXISTS public.has_role(TEXT);

-- D.4: Drop users.role column — all RLS policies now use has_permission()
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- D.5: Drop user_role enum — no longer referenced
DROP TYPE IF EXISTS public.user_role;


COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Summary:
--   - All existing RLS policies dropped from 25 tables + storage.objects
--   - Fresh permission-matrix policies created using has_permission()
--   - user_permissions table: direct subquery used to avoid recursion
--   - file_attachments + comments: parent entity permission enforced via helper functions
--   - stock_out_approvals: layer-specific sor_l1/sor_l2/sor_l3 permissions
--   - Reference/config tables: universally readable, admin-writable
--   - attachment_entity_resource() + comment_entity_resource() helpers created
--   - can_view_sor_request() updated to use has_permission('sor', 'view')
--   - can_view_sor_approval() dropped (direct has_permission() in policy)
--   - owns_qmrl() dropped (own-records pattern removed)
--   - delete_file_attachment() updated to use check_user_permission()
--   - handle_new_user() updated: role column removed from INSERT
--   - get_user_role(), has_role() dropped
--   - users.role column dropped
--   - user_role enum dropped
-- ============================================
