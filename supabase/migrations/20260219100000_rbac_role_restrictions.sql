-- ============================================
-- Migration: 20260219100000_rbac_role_restrictions.sql
-- Description: Tighten RBAC role restrictions for qmrl and qmhq roles
--
-- Changes:
--   1. QMRL role - restrict from reading qmhq table (was USING (true), now admin/qmhq only)
--   2. QMHQ role - restrict purchase_orders, invoices, financial_transactions,
--      inventory_transactions, po_line_items, invoice_line_items, stock_out_requests,
--      stock_out_line_items, stock_out_approvals, warehouses, suppliers
--      from full CRUD to read-only (qmhq role keeps SELECT, loses INSERT/UPDATE/DELETE)
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: QMHQ table
-- Old: SELECT USING (true) — qmrl role could read qmhq
-- New: SELECT restricted to admin and qmhq roles only
-- ============================================

DROP POLICY IF EXISTS qmhq_select ON public.qmhq;

CREATE POLICY qmhq_select ON public.qmhq
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- ============================================
-- SECTION 2: FINANCIAL_TRANSACTIONS table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only (INSERT/UPDATE/DELETE restricted to admin only)
-- ============================================

DROP POLICY IF EXISTS financial_transactions_insert ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_update ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_delete ON public.financial_transactions;

CREATE POLICY financial_transactions_insert ON public.financial_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY financial_transactions_update ON public.financial_transactions
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY financial_transactions_delete ON public.financial_transactions
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 3: PURCHASE_ORDERS table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only
-- ============================================

DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;

CREATE POLICY purchase_orders_insert ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY purchase_orders_delete ON public.purchase_orders
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 4: PO_LINE_ITEMS table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only
-- ============================================

DROP POLICY IF EXISTS po_line_items_insert ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_update ON public.po_line_items;
DROP POLICY IF EXISTS po_line_items_delete ON public.po_line_items;

CREATE POLICY po_line_items_insert ON public.po_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY po_line_items_update ON public.po_line_items
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY po_line_items_delete ON public.po_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 5: INVOICES table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only
-- ============================================

DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 6: INVOICE_LINE_ITEMS table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only
-- ============================================

DROP POLICY IF EXISTS invoice_line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;

CREATE POLICY invoice_line_items_insert ON public.invoice_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY invoice_line_items_update ON public.invoice_line_items
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY invoice_line_items_delete ON public.invoice_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 7: INVENTORY_TRANSACTIONS table
-- Old: qmhq role had full CRUD
-- New: qmhq role read-only (SELECT stays, write operations admin only)
-- ============================================

DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;

CREATE POLICY inventory_transactions_insert ON public.inventory_transactions
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY inventory_transactions_update ON public.inventory_transactions
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY inventory_transactions_delete ON public.inventory_transactions
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 8: STOCK_OUT_REQUESTS table
-- Old: qmhq role had CRUD (insert + update own)
-- New: qmhq role read-only; admin controls writes
-- Note: sor_select policy already restricts qmrl (no change needed there)
-- ============================================

DROP POLICY IF EXISTS sor_insert ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_update ON public.stock_out_requests;
DROP POLICY IF EXISTS sor_delete ON public.stock_out_requests;

CREATE POLICY sor_insert ON public.stock_out_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_update ON public.stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_delete ON public.stock_out_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 9: STOCK_OUT_LINE_ITEMS table
-- Old: qmhq role had insert/update
-- New: admin only for writes
-- ============================================

DROP POLICY IF EXISTS sor_li_insert ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_update ON public.stock_out_line_items;
DROP POLICY IF EXISTS sor_li_delete ON public.stock_out_line_items;

CREATE POLICY sor_li_insert ON public.stock_out_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_li_update ON public.stock_out_line_items
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY sor_li_delete ON public.stock_out_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 10: SUPPLIERS table
-- Old: qmhq role had CRUD
-- New: qmhq role read-only (to support dropdowns in QMHQ forms)
-- ============================================

DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 11: WAREHOUSES table
-- Old: qmhq role had full SELECT + write access
-- New: qmhq role read-only SELECT (for dropdowns in QMHQ forms); admin only for writes
-- Note: QMRL role has NO warehouse access (already enforced by existing SELECT policy)
-- ============================================

-- SELECT policy already restricts to admin+qmhq (no change needed)
-- Only drop/recreate write policies to remove qmhq from INSERT/UPDATE/DELETE

DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

CREATE POLICY warehouses_insert ON public.warehouses
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY warehouses_update ON public.warehouses
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY warehouses_delete ON public.warehouses
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 12: STATUS_CONFIG table
-- Old: qmhq role could INSERT (create statuses)
-- New: admin only (qmhq can still read for dropdowns)
-- ============================================

DROP POLICY IF EXISTS status_config_insert ON public.status_config;

CREATE POLICY status_config_insert ON public.status_config
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SECTION 13: CATEGORIES table
-- Old: qmhq role could INSERT (create categories)
-- New: admin only (qmhq can still read for dropdowns)
-- ============================================

DROP POLICY IF EXISTS categories_insert ON public.categories;

CREATE POLICY categories_insert ON public.categories
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Summary of changes:
--   - qmhq_select: now restricted to admin+qmhq (qmrl can no longer read QMHQ data via RLS)
--   - financial_transactions: qmhq read-only (admin writes)
--   - purchase_orders + po_line_items: qmhq read-only (admin writes)
--   - invoices + invoice_line_items: qmhq read-only (admin writes)
--   - inventory_transactions: qmhq read-only (admin writes)
--   - stock_out_requests + line_items: qmhq read-only (admin writes)
--   - suppliers: qmhq read-only (admin writes)
--   - warehouses: qmhq read-only (admin writes)
--   - status_config + categories: admin-only writes (qmhq read-only)
-- ============================================
