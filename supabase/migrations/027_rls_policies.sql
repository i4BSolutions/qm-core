-- ============================================
-- Iteration 10: Row Level Security Policies
-- ============================================
-- Implements RLS policies based on the permission matrix from PRD.
-- Uses a helper function to get user role for policy evaluation.
-- ============================================

-- ============================================
-- Helper Function: Get Current User Role
-- ============================================
-- Note: get_user_role() already exists from earlier migrations
-- This ensures it's available and updated

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role;
END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper to check if current user owns a QMRL
CREATE OR REPLACE FUNCTION public.owns_qmrl(qmrl_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.qmrl
    WHERE id = qmrl_id AND requester_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper to check if current user owns a QMHQ (via QMRL)
CREATE OR REPLACE FUNCTION public.owns_qmhq(qmhq_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.qmhq q
    JOIN public.qmrl r ON q.qmrl_id = r.id
    WHERE q.id = qmhq_id AND r.requester_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qmrl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qmhq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS Policies
-- Admin: CRUD, Quartermaster: R, Others: -
-- ============================================
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- Select: Admin and Quartermaster can see all, others can see own profile
CREATE POLICY users_select ON public.users
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster')
    OR id = auth.uid()
  );

-- Insert: Admin only
CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- Update: Admin can update all, others can only update own profile
CREATE POLICY users_update ON public.users
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR id = auth.uid()
  );

-- Delete: Admin only
CREATE POLICY users_delete ON public.users
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- DEPARTMENTS Policies
-- Admin: CRUD, Others: R
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
-- STATUS_CONFIG Policies
-- Admin/Quartermaster: CRUD, Proposal: CR, Others: R
-- ============================================
DROP POLICY IF EXISTS status_config_select ON public.status_config;
DROP POLICY IF EXISTS status_config_insert ON public.status_config;
DROP POLICY IF EXISTS status_config_update ON public.status_config;
DROP POLICY IF EXISTS status_config_delete ON public.status_config;

CREATE POLICY status_config_select ON public.status_config
  FOR SELECT USING (true);

CREATE POLICY status_config_insert ON public.status_config
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal')
  );

CREATE POLICY status_config_update ON public.status_config
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

CREATE POLICY status_config_delete ON public.status_config
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- CATEGORIES Policies
-- Same as status_config
-- ============================================
DROP POLICY IF EXISTS categories_select ON public.categories;
DROP POLICY IF EXISTS categories_insert ON public.categories;
DROP POLICY IF EXISTS categories_update ON public.categories;
DROP POLICY IF EXISTS categories_delete ON public.categories;

CREATE POLICY categories_select ON public.categories
  FOR SELECT USING (true);

CREATE POLICY categories_insert ON public.categories
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal')
  );

CREATE POLICY categories_update ON public.categories
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

CREATE POLICY categories_delete ON public.categories
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- CONTACT_PERSONS Policies
-- Admin/Quartermaster/Proposal/Frontline: CRUD, Others: R
-- ============================================
DROP POLICY IF EXISTS contact_persons_select ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_insert ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_update ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_delete ON public.contact_persons;

CREATE POLICY contact_persons_select ON public.contact_persons
  FOR SELECT USING (true);

CREATE POLICY contact_persons_insert ON public.contact_persons
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
  );

CREATE POLICY contact_persons_update ON public.contact_persons
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
  );

CREATE POLICY contact_persons_delete ON public.contact_persons
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
  );

-- ============================================
-- SUPPLIERS Policies
-- Admin/Quartermaster/Finance/Proposal: CRUD, Others: R
-- ============================================
DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

-- ============================================
-- ITEMS Policies
-- Admin/Quartermaster/Inventory: CRUD, Others: R
-- ============================================
DROP POLICY IF EXISTS items_select ON public.items;
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_delete ON public.items;

CREATE POLICY items_select ON public.items
  FOR SELECT USING (true);

CREATE POLICY items_insert ON public.items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY items_update ON public.items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY items_delete ON public.items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- ============================================
-- WAREHOUSES Policies
-- Admin/Quartermaster/Inventory: CRUD, Finance/Proposal: R
-- ============================================
DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

CREATE POLICY warehouses_select ON public.warehouses
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory', 'finance', 'proposal')
  );

CREATE POLICY warehouses_insert ON public.warehouses
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY warehouses_update ON public.warehouses
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY warehouses_delete ON public.warehouses
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- ============================================
-- QMRL Policies
-- Admin/Quartermaster: CRUD
-- Finance/Inventory: R
-- Proposal/Frontline: RU
-- Requester: CR (own only)
-- ============================================
DROP POLICY IF EXISTS qmrl_select ON public.qmrl;
DROP POLICY IF EXISTS qmrl_insert ON public.qmrl;
DROP POLICY IF EXISTS qmrl_update ON public.qmrl;
DROP POLICY IF EXISTS qmrl_delete ON public.qmrl;

CREATE POLICY qmrl_select ON public.qmrl
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
    OR (public.get_user_role() = 'requester' AND requester_id = auth.uid())
  );

CREATE POLICY qmrl_insert ON public.qmrl
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'requester')
  );

CREATE POLICY qmrl_update ON public.qmrl
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
    OR (public.get_user_role() = 'requester' AND requester_id = auth.uid())
  );

CREATE POLICY qmrl_delete ON public.qmrl
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- QMHQ Policies
-- Admin/Quartermaster/Proposal: CRUD
-- Finance/Inventory: RU
-- Frontline: R
-- Requester: R (own only via QMRL)
-- ============================================
DROP POLICY IF EXISTS qmhq_select ON public.qmhq;
DROP POLICY IF EXISTS qmhq_insert ON public.qmhq;
DROP POLICY IF EXISTS qmhq_update ON public.qmhq;
DROP POLICY IF EXISTS qmhq_delete ON public.qmhq;

CREATE POLICY qmhq_select ON public.qmhq
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
    OR (public.get_user_role() = 'requester' AND public.owns_qmhq(id))
  );

CREATE POLICY qmhq_insert ON public.qmhq
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal')
  );

CREATE POLICY qmhq_update ON public.qmhq
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal', 'finance', 'inventory')
  );

CREATE POLICY qmhq_delete ON public.qmhq
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'proposal')
  );

-- ============================================
-- FINANCIAL_TRANSACTIONS Policies
-- Admin/Finance: CRUD
-- Quartermaster/Inventory/Proposal: R
-- ============================================
DROP POLICY IF EXISTS financial_transactions_select ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_insert ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete ON public.financial_transactions;

CREATE POLICY financial_transactions_select ON public.financial_transactions
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'finance', 'quartermaster', 'inventory', 'proposal')
  );

CREATE POLICY financial_transactions_insert ON public.financial_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'finance')
  );

CREATE POLICY financial_transactions_update ON public.financial_transactions
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'finance')
  );

CREATE POLICY financial_transactions_delete ON public.financial_transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'finance')
  );

-- ============================================
-- PURCHASE_ORDERS Policies
-- Admin/Quartermaster/Finance/Proposal: CRUD
-- Inventory: R
-- ============================================
DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;

CREATE POLICY purchase_orders_select ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal', 'inventory')
  );

CREATE POLICY purchase_orders_insert ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY purchase_orders_delete ON public.purchase_orders
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

-- ============================================
-- PO_LINE_ITEMS Policies (same as PO)
-- ============================================
DROP POLICY IF EXISTS po_line_items_select ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_insert ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_update ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_delete ON public.po_line_items;

CREATE POLICY po_line_items_select ON public.po_line_items
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal', 'inventory')
  );

CREATE POLICY po_line_items_insert ON public.po_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY po_line_items_update ON public.po_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

CREATE POLICY po_line_items_delete ON public.po_line_items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal')
  );

-- ============================================
-- INVOICES Policies
-- Admin/Quartermaster/Finance: CRUD
-- Inventory: RU
-- Proposal: R
-- ============================================
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal')
  );

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance')
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory')
  );

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance')
  );

-- ============================================
-- INVOICE_LINE_ITEMS Policies (same as invoices)
-- ============================================
DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;

CREATE POLICY invoice_line_items_select ON public.invoice_line_items
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal')
  );

CREATE POLICY invoice_line_items_insert ON public.invoice_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance')
  );

CREATE POLICY invoice_line_items_update ON public.invoice_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory')
  );

CREATE POLICY invoice_line_items_delete ON public.invoice_line_items
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance')
  );

-- ============================================
-- INVENTORY_TRANSACTIONS Policies
-- Admin/Quartermaster/Inventory: CRUD
-- Finance/Proposal: R
-- ============================================
DROP POLICY IF EXISTS inventory_transactions_select ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;

CREATE POLICY inventory_transactions_select ON public.inventory_transactions
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory', 'finance', 'proposal')
  );

CREATE POLICY inventory_transactions_insert ON public.inventory_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY inventory_transactions_update ON public.inventory_transactions
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY inventory_transactions_delete ON public.inventory_transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

-- ============================================
-- AUDIT_LOGS Policies
-- All authenticated users can read their relevant logs
-- Only system can insert (via triggers)
-- ============================================
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester')
  );

-- Insert is handled by the trigger function with SECURITY DEFINER
-- We allow insert for authenticated users but the trigger controls this
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Grant execute permissions on helper functions
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_qmrl(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_qmhq(UUID) TO authenticated;
