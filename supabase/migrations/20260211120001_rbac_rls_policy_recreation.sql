-- ============================================
-- Migration: 20260211120001_rbac_rls_policy_recreation.sql
-- Description: Recreate all RLS policies and helper functions with new 3-role enum values
-- Dependencies: 20260211120000_rbac_enum_migration.sql (enum swap to admin, qmrl, qmhq)
-- Phase: 37-rbac-database-migration
-- Plan: 37-02
-- ============================================
-- After the enum migration, all RLS policies still reference old role values.
-- This migration drops and recreates all role-dependent policies and functions
-- with the new role mapping:
--   admin, quartermaster -> admin
--   finance, inventory, proposal -> qmhq
--   frontline, requester -> qmrl
--
-- Wrapped in a single transaction for atomicity. If any policy creation fails,
-- the entire transaction rolls back and default-deny keeps the database secure.
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: USERS table
-- Old: Admin/Quartermaster full access, others read own
-- New: Admin full access, others read own
-- ============================================

DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- Select own profile: Everyone can read their own row
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (id = auth.uid());

-- Select all: Admin only (quartermaster merged into admin)
CREATE POLICY users_select_admin ON public.users
  FOR SELECT USING (
    public.get_user_role() = 'admin'
  );

-- Insert: Admin only
CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- Update own profile: Users can update their own profile
CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (id = auth.uid());

-- Update all: Admin can update anyone
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- Delete: Admin only
CREATE POLICY users_delete ON public.users
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 2: DEPARTMENTS table
-- Old: Admin only
-- New: Admin only (unchanged logic, recreate for consistency)
-- ============================================

DROP POLICY IF EXISTS departments_select ON public.departments;
DROP POLICY IF EXISTS departments_insert ON public.departments;
DROP POLICY IF EXISTS departments_update ON public.departments;
DROP POLICY IF EXISTS departments_delete ON public.departments;

CREATE POLICY departments_select ON public.departments
  FOR SELECT USING (true);

CREATE POLICY departments_insert ON public.departments
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY departments_update ON public.departments
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY departments_delete ON public.departments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 3: STATUS_CONFIG table
-- Old: Admin/Quartermaster CRUD, Proposal CR, Others R
-- New: Admin CRUD, QMHQ CR, Others R
-- ============================================

DROP POLICY IF EXISTS status_config_select ON public.status_config;
DROP POLICY IF EXISTS status_config_insert ON public.status_config;
DROP POLICY IF EXISTS status_config_update ON public.status_config;
DROP POLICY IF EXISTS status_config_delete ON public.status_config;

CREATE POLICY status_config_select ON public.status_config
  FOR SELECT USING (true);

-- Insert: Admin + QMHQ (proposal mapped to qmhq)
CREATE POLICY status_config_insert ON public.status_config
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- Update: Admin only (quartermaster merged into admin)
CREATE POLICY status_config_update ON public.status_config
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- Delete: Admin only
CREATE POLICY status_config_delete ON public.status_config
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 4: CATEGORIES table
-- Same as STATUS_CONFIG
-- ============================================

DROP POLICY IF EXISTS categories_select ON public.categories;
DROP POLICY IF EXISTS categories_insert ON public.categories;
DROP POLICY IF EXISTS categories_update ON public.categories;
DROP POLICY IF EXISTS categories_delete ON public.categories;

CREATE POLICY categories_select ON public.categories
  FOR SELECT USING (true);

CREATE POLICY categories_insert ON public.categories
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY categories_update ON public.categories
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY categories_delete ON public.categories
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 5: CONTACT_PERSONS table
-- Old: Admin/Quartermaster/Proposal/Frontline CRUD, Others R
-- New: All authenticated users (covers all 3 roles)
-- ============================================

DROP POLICY IF EXISTS contact_persons_select ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_insert ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_update ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_delete ON public.contact_persons;

CREATE POLICY contact_persons_select ON public.contact_persons
  FOR SELECT USING (true);

-- All 3 roles can create contacts
CREATE POLICY contact_persons_insert ON public.contact_persons
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq', 'qmrl')
  );

CREATE POLICY contact_persons_update ON public.contact_persons
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq', 'qmrl')
  );

CREATE POLICY contact_persons_delete ON public.contact_persons
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq', 'qmrl')
  );

-- ============================================
-- SECTION 6: SUPPLIERS table
-- Old: Admin/Quartermaster/Finance/Proposal CRUD, Others R
-- New: Admin/QMHQ CRUD, Others R
-- ============================================

DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 7: ITEMS table
-- Old: Admin/Quartermaster/Inventory CRUD, Others R
-- New: Admin/QMHQ CRUD, Others R
-- ============================================

DROP POLICY IF EXISTS items_select ON public.items;
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_delete ON public.items;

CREATE POLICY items_select ON public.items
  FOR SELECT USING (true);

CREATE POLICY items_insert ON public.items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY items_update ON public.items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY items_delete ON public.items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 8: WAREHOUSES table
-- Old: Admin/Quartermaster/Inventory CRUD, Finance/Proposal R
-- New: Admin/QMHQ CRUD and R
-- ============================================

DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

CREATE POLICY warehouses_select ON public.warehouses
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY warehouses_insert ON public.warehouses
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY warehouses_update ON public.warehouses
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY warehouses_delete ON public.warehouses
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 9: QMRL table
-- Old: Admin/Quartermaster CRUD, Finance/Inventory R, Proposal/Frontline RU, Requester CR (own)
-- New: All authenticated users can view, Admin/QMRL can create, All can update, Admin can delete
-- ============================================

DROP POLICY IF EXISTS qmrl_select ON public.qmrl;
DROP POLICY IF EXISTS qmrl_insert ON public.qmrl;
DROP POLICY IF EXISTS qmrl_update ON public.qmrl;
DROP POLICY IF EXISTS qmrl_delete ON public.qmrl;

-- All authenticated users can view all QMRLs
CREATE POLICY qmrl_select ON public.qmrl
  FOR SELECT USING (true);

-- Admin and QMRL role can create (requester -> qmrl)
CREATE POLICY qmrl_insert ON public.qmrl
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmrl')
  );

-- All roles can update QMRLs
CREATE POLICY qmrl_update ON public.qmrl
  FOR UPDATE USING (true);

-- Admin only can delete
CREATE POLICY qmrl_delete ON public.qmrl
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 10: QMHQ table
-- Old: Admin/Quartermaster/Proposal CRUD, Finance/Inventory RU, Frontline R, Requester R (own)
-- New: All authenticated users can view, Admin/QMHQ can CUD
-- ============================================

DROP POLICY IF EXISTS qmhq_select ON public.qmhq;
DROP POLICY IF EXISTS qmhq_insert ON public.qmhq;
DROP POLICY IF EXISTS qmhq_update ON public.qmhq;
DROP POLICY IF EXISTS qmhq_delete ON public.qmhq;

-- All authenticated users can view all QMHQs
CREATE POLICY qmhq_select ON public.qmhq
  FOR SELECT USING (true);

-- Admin and QMHQ can create
CREATE POLICY qmhq_insert ON public.qmhq
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- Admin and QMHQ can update
CREATE POLICY qmhq_update ON public.qmhq
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- Admin and QMHQ can delete
CREATE POLICY qmhq_delete ON public.qmhq
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 11: FINANCIAL_TRANSACTIONS table
-- Old: Admin/Finance CRUD, Quartermaster/Inventory/Proposal R
-- New: Admin/QMHQ CRUD
-- ============================================

DROP POLICY IF EXISTS financial_transactions_select ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_insert ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete ON public.financial_transactions;

CREATE POLICY financial_transactions_select ON public.financial_transactions
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY financial_transactions_insert ON public.financial_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY financial_transactions_update ON public.financial_transactions
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY financial_transactions_delete ON public.financial_transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 12: PURCHASE_ORDERS table
-- Old: Admin/Quartermaster/Finance/Proposal CRUD, Inventory R
-- New: Admin/QMHQ CRUD
-- ============================================

DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;

CREATE POLICY purchase_orders_select ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY purchase_orders_insert ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY purchase_orders_delete ON public.purchase_orders
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 13: PO_LINE_ITEMS table
-- Same as PURCHASE_ORDERS
-- ============================================

DROP POLICY IF EXISTS po_line_items_select ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_insert ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_update ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_delete ON public.po_line_items;

CREATE POLICY po_line_items_select ON public.po_line_items
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY po_line_items_insert ON public.po_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY po_line_items_update ON public.po_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY po_line_items_delete ON public.po_line_items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 14: INVOICES table
-- Old: Admin/Quartermaster/Finance CRUD, Inventory RU, Proposal R
-- New: Admin/QMHQ CRUD
-- ============================================

DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 15: INVOICE_LINE_ITEMS table
-- Same as INVOICES
-- ============================================

DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;

CREATE POLICY invoice_line_items_select ON public.invoice_line_items
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoice_line_items_insert ON public.invoice_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoice_line_items_update ON public.invoice_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY invoice_line_items_delete ON public.invoice_line_items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 16: INVENTORY_TRANSACTIONS table
-- Old: Admin/Quartermaster/Inventory CRUD, Finance/Proposal R
-- New: Admin/QMHQ CRUD
-- ============================================

DROP POLICY IF EXISTS inventory_transactions_select ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;

CREATE POLICY inventory_transactions_select ON public.inventory_transactions
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY inventory_transactions_insert ON public.inventory_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY inventory_transactions_update ON public.inventory_transactions
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY inventory_transactions_delete ON public.inventory_transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 17: AUDIT_LOGS table
-- Old: All 7 roles can read, trigger controls insert
-- New: All authenticated users can read
-- ============================================

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

-- All authenticated users can view audit logs
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT USING (true);

-- Insert controlled by trigger (SECURITY DEFINER)
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- SECTION 18: FILE_ATTACHMENTS table
-- Old: Complex role-based upload/delete permissions
-- New: Simplified with new roles
-- ============================================

DROP POLICY IF EXISTS file_attachments_select ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_insert ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_delete ON public.file_attachments;

-- SELECT: All authenticated users can view non-deleted files
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT USING (
    deleted_at IS NULL
  );

-- INSERT: Admin and QMHQ can upload to any entity, QMRL can upload to own QMRL entities
CREATE POLICY file_attachments_insert ON public.file_attachments
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
    OR (
      public.get_user_role() = 'qmrl'
      AND entity_type = 'qmrl'
      AND public.owns_qmrl(entity_id)
    )
  );

-- UPDATE: Admin or original uploader can update (soft-delete)
CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (
    public.get_user_role() = 'admin'
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR uploaded_by = auth.uid()
  );

-- DELETE: Admin only (hard delete for cleanup)
CREATE POLICY file_attachments_delete ON public.file_attachments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 19: STORAGE.OBJECTS policies
-- Old: Complex role-based storage access
-- New: Simplified with new roles
-- ============================================

DROP POLICY IF EXISTS storage_attachments_select ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_update ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_delete ON storage.objects;

-- SELECT: Download if file exists in file_attachments and is not deleted
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

-- INSERT: Admin and QMHQ can upload to any path, QMRL can upload to own QMRL paths
CREATE POLICY storage_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      public.get_user_role() IN ('admin', 'qmhq')
      OR (
        public.get_user_role() = 'qmrl'
        AND (storage.foldername(name))[1] = 'qmrl'
        AND public.owns_qmrl(((storage.foldername(name))[2])::uuid)
      )
    )
  );

-- UPDATE: Admin only
CREATE POLICY storage_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() = 'admin'
  );

-- DELETE: Admin only
CREATE POLICY storage_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 20: COMMENTS table
-- Old: Privileged roles + requester own-only
-- New: All authenticated users can comment
-- ============================================

DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;

-- SELECT: All authenticated users can view non-deleted comments
CREATE POLICY comments_select ON public.comments
  FOR SELECT USING (
    deleted_at IS NULL
  );

-- INSERT: All authenticated users can comment
CREATE POLICY comments_insert ON public.comments
  FOR INSERT WITH CHECK (true);

-- UPDATE: Users can soft-delete their own comments if no replies
CREATE POLICY comments_update ON public.comments
  FOR UPDATE USING (
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  );

-- DELETE: Admin only (hard delete for cleanup)
CREATE POLICY comments_delete ON public.comments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 21: STOCK_OUT_REQUESTS table
-- Old: Admin/Quartermaster/Inventory see all, others see own
-- New: Admin/QMHQ see all, others see own
-- ============================================

DROP POLICY IF EXISTS sor_select ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_insert ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_update ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_delete ON public.stock_out_requests;

CREATE POLICY sor_select ON public.stock_out_requests
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
    OR requester_id = auth.uid()
  );

CREATE POLICY sor_insert ON public.stock_out_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY sor_update ON public.stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR requester_id = auth.uid()
  );

CREATE POLICY sor_delete ON public.stock_out_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 22: STOCK_OUT_LINE_ITEMS table
-- Old: Admin/Quartermaster/Inventory CRUD
-- New: Admin/QMHQ CRUD
-- ============================================

DROP POLICY IF EXISTS sor_li_select ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_insert ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_update ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_delete ON public.stock_out_line_items;

-- SELECT uses helper function (will be updated separately)
CREATE POLICY sor_li_select ON public.stock_out_line_items
  FOR SELECT USING (
    public.can_view_sor_request(request_id)
  );

CREATE POLICY sor_li_insert ON public.stock_out_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY sor_li_update ON public.stock_out_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY sor_li_delete ON public.stock_out_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 23: STOCK_OUT_APPROVALS table
-- Admin only for all operations
-- ============================================

DROP POLICY IF EXISTS sor_approval_select ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_insert ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_update ON public.stock_out_approvals;
DROP POLICY IF EXISTS sor_approval_delete ON public.stock_out_approvals;

CREATE POLICY sor_approval_select ON public.stock_out_approvals
  FOR SELECT USING (
    public.can_view_sor_approval(line_item_id)
  );

CREATE POLICY sor_approval_insert ON public.stock_out_approvals
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_approval_update ON public.stock_out_approvals
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_approval_delete ON public.stock_out_approvals
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- HELPER FUNCTION UPDATES
-- ============================================

-- Update can_view_sor_request to use new role values
CREATE OR REPLACE FUNCTION public.can_view_sor_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  req_requester_id UUID;
  user_role public.user_role;
BEGIN
  user_role := public.get_user_role();

  -- Admin and QMHQ can view all (quartermaster, inventory -> qmhq)
  IF user_role IN ('admin', 'qmhq') THEN
    RETURN TRUE;
  END IF;

  -- Others can view only their own requests
  SELECT requester_id INTO req_requester_id
  FROM stock_out_requests
  WHERE id = p_request_id;

  RETURN req_requester_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update delete_file_attachment RPC to use new role values
CREATE OR REPLACE FUNCTION public.delete_file_attachment(
  p_file_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_file RECORD;
  v_user_role TEXT;
  v_can_delete BOOLEAN := FALSE;
BEGIN
  -- Get file info
  SELECT id, entity_type, entity_id, uploaded_by, storage_path
  INTO v_file
  FROM public.file_attachments
  WHERE id = p_file_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'File not found');
  END IF;

  -- Get user role
  SELECT role::TEXT INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;

  -- Check authorization:
  -- 1. Admin can delete any file
  IF v_user_role = 'admin' THEN
    v_can_delete := TRUE;
  -- 2. Original uploader can delete their own file
  ELSIF v_file.uploaded_by = p_user_id THEN
    v_can_delete := TRUE;
  -- 3. QMHQ and QMRL roles can delete files on entities they can access
  ELSIF v_file.entity_type = 'qmrl' THEN
    -- QMHQ can delete QMRL files, QMRL users can delete files on their own QMRL
    SELECT EXISTS(
      SELECT 1 FROM public.qmrl
      WHERE id = v_file.entity_id
      AND (
        v_user_role = 'qmhq'
        OR (v_user_role = 'qmrl' AND requester_id = p_user_id)
      )
    ) INTO v_can_delete;
  ELSIF v_file.entity_type = 'qmhq' THEN
    -- Only admin and QMHQ can delete QMHQ files
    v_can_delete := (v_user_role = 'qmhq');
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

-- ============================================
-- VERIFICATION
-- ============================================

-- Check for any remaining old role values in function definitions
DO $$
DECLARE
  old_role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_role_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND (
      p.prosrc LIKE '%quartermaster%'
      OR p.prosrc LIKE '%finance%'
      OR p.prosrc LIKE '%inventory%'
      OR p.prosrc LIKE '%proposal%'
      OR p.prosrc LIKE '%frontline%'
      OR p.prosrc LIKE '%requester%'
    )
    -- Exclude functions that legitimately reference old roles in comments or audit logs
    AND p.proname NOT IN ('create_audit_log', 'update_file_attachments_updated_at', 'update_comments_updated_at');

  IF old_role_count > 0 THEN
    RAISE WARNING 'Found % public functions still referencing old role values', old_role_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All RLS policies and helper functions updated to new role values';
  END IF;
END $$;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All RLS policies across 20 tables have been recreated with new role values.
-- Helper functions can_view_sor_request() and delete_file_attachment() updated.
-- Transaction ensures atomicity - any failure triggers rollback with default-deny security.
-- ============================================
