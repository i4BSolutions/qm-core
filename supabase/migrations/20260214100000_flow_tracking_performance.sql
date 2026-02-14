-- Migration: 20260214100000_flow_tracking_performance.sql
-- Description: Optimize flow tracking VIEW with covering indexes and eliminate OR join
-- Dependencies: 20260211140000_flow_tracking_view.sql
-- Phase: 45-flow-tracking-performance
-- Plan: 45-01

-- ============================================================================
-- PERFORMANCE OPTIMIZATION: COVERING PARTIAL INDEXES
-- ============================================================================
-- Add partial indexes on foreign key columns used by qmrl_flow_chain VIEW.
-- These indexes are filtered with `WHERE is_active = true` to match the VIEW's
-- filter conditions, enabling PostgreSQL to use index scans instead of sequential scans.
--
-- Note: Using CREATE INDEX (not CONCURRENTLY) because Supabase migrations run
-- inside transactions. CONCURRENTLY is only for production hot-patching.

-- QMHQ: join on qmrl_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_qmhq_qmrl_id_active
  ON qmhq(qmrl_id) WHERE is_active = true;

-- Purchase Orders: join on qmhq_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_purchase_orders_qmhq_id_active
  ON purchase_orders(qmhq_id) WHERE is_active = true;

-- Invoices: join on po_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_invoices_po_id_active
  ON invoices(po_id) WHERE is_active = true;

-- Inventory transactions: join on invoice_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_id_active
  ON inventory_transactions(invoice_id) WHERE is_active = true;

-- Inventory transactions: join on qmhq_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_qmhq_id_active
  ON inventory_transactions(qmhq_id) WHERE is_active = true;

-- Financial transactions: join on qmhq_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_financial_transactions_qmhq_id_active
  ON financial_transactions(qmhq_id) WHERE is_active = true;

-- Stock-out requests: join on qmhq_id with is_active filter
CREATE INDEX IF NOT EXISTS idx_stock_out_requests_qmhq_id_active
  ON stock_out_requests(qmhq_id) WHERE is_active = true;

-- QMRL: covering index for the root WHERE + ORDER BY
-- The query filters by qmrl_request_id and is_active, so we index created_at DESC
-- for efficient sorting on active QMRLs
CREATE INDEX IF NOT EXISTS idx_qmrl_active_created_desc
  ON qmrl(created_at DESC) WHERE is_active = true;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION: ELIMINATE OR JOIN
-- ============================================================================
-- Rewrite qmrl_flow_chain VIEW to eliminate the OR condition in the
-- inventory_transactions join. PostgreSQL cannot use indexes on OR conditions,
-- causing full table scans.
--
-- OLD (slow):
--   LEFT JOIN inventory_transactions AS inv_trans
--     ON (inv_trans.invoice_id = invoice.id OR inv_trans.qmhq_id = qmhq.id)
--     AND inv_trans.is_active = true
--
-- NEW (fast):
--   LEFT JOIN inventory_transactions AS stock_in_trans
--     ON stock_in_trans.invoice_id = invoice.id
--     AND stock_in_trans.is_active = true
--
--   LEFT JOIN inventory_transactions AS stock_out_trans
--     ON stock_out_trans.qmhq_id = qmhq.id
--     AND stock_out_trans.is_active = true
--
-- Then use COALESCE in SELECT to merge into single set of columns.
-- This allows PostgreSQL to use the new partial indexes for index scans.
--
-- Also removed ORDER BY from VIEW definition - the client-side query already
-- filters by specific qmrl_request_id, and the TypeScript transformation
-- doesn't depend on row order.

CREATE OR REPLACE VIEW qmrl_flow_chain AS
SELECT
  -- QMRL fields (root entity)
  qmrl.id AS qmrl_id,
  qmrl.request_id AS qmrl_request_id,
  qmrl.title AS qmrl_title,
  qmrl.priority AS qmrl_priority,
  qmrl.request_date AS qmrl_request_date,
  qmrl.created_at AS qmrl_created_at,

  -- QMRL status (from status_config)
  qmrl_status.name AS qmrl_status_name,
  qmrl_status.color AS qmrl_status_color,

  -- QMRL requester (from users)
  qmrl_requester.id AS qmrl_requester_id,
  qmrl_requester.full_name AS qmrl_requester_full_name,
  qmrl_requester.avatar_url AS qmrl_requester_avatar_url,

  -- QMRL assigned_to (from users)
  qmrl_assigned.id AS qmrl_assigned_id,
  qmrl_assigned.full_name AS qmrl_assigned_full_name,
  qmrl_assigned.avatar_url AS qmrl_assigned_avatar_url,

  -- QMRL contact person
  qmrl_contact.name AS qmrl_contact_person_name,

  -- QMHQ fields (child of QMRL)
  qmhq.id AS qmhq_id,
  qmhq.request_id AS qmhq_request_id,
  qmhq.line_name AS qmhq_line_name,
  qmhq.route_type AS qmhq_route_type,
  qmhq.created_at AS qmhq_created_at,

  -- QMHQ status (from status_config)
  qmhq_status.name AS qmhq_status_name,
  qmhq_status.color AS qmhq_status_color,

  -- QMHQ assigned_to (from users)
  qmhq_assigned.id AS qmhq_assigned_id,
  qmhq_assigned.full_name AS qmhq_assigned_full_name,
  qmhq_assigned.avatar_url AS qmhq_assigned_avatar_url,

  -- QMHQ contact person
  qmhq_contact.name AS qmhq_contact_person_name,

  -- Purchase Order fields (child of QMHQ, only for PO route)
  po.id AS po_id,
  po.po_number AS po_po_number,
  po.status AS po_status,
  po.po_date AS po_po_date,
  po.expected_delivery_date AS po_expected_delivery_date,
  po.created_at AS po_created_at,
  po.is_active AS po_is_active,

  -- PO supplier
  supplier.name AS po_supplier_name,

  -- Invoice fields (child of PO)
  invoice.id AS invoice_id,
  invoice.invoice_number AS invoice_invoice_number,
  invoice.status AS invoice_status,
  invoice.invoice_date AS invoice_invoice_date,
  invoice.due_date AS invoice_due_date,
  invoice.is_voided AS invoice_is_voided,
  invoice.created_at AS invoice_created_at,
  invoice.is_active AS invoice_is_active,

  -- Inventory Transaction fields (merged via COALESCE from two separate joins)
  -- stock_in_trans: linked to invoice (PO route stock-in)
  -- stock_out_trans: linked to qmhq (item route stock-out)
  COALESCE(stock_in_trans.id, stock_out_trans.id) AS stock_id,
  COALESCE(stock_in_trans.movement_type, stock_out_trans.movement_type) AS stock_movement_type,
  COALESCE(stock_in_trans.status, stock_out_trans.status) AS stock_status,
  COALESCE(stock_in_trans.transaction_date, stock_out_trans.transaction_date) AS stock_transaction_date,
  COALESCE(stock_in_trans.created_at, stock_out_trans.created_at) AS stock_created_at,

  -- Financial Transaction fields (linked to QMHQ for expense route)
  fin_trans.id AS ft_id,
  fin_trans.transaction_type AS ft_transaction_type,
  fin_trans.transaction_date AS ft_transaction_date,
  fin_trans.created_at AS ft_created_at,
  fin_trans.is_voided AS ft_is_voided,

  -- Stock-Out Request fields (linked to QMHQ for item route)
  sor.id AS sor_id,
  sor.request_number AS sor_request_number,
  sor.status AS sor_status,
  sor.created_at AS sor_created_at

FROM qmrl

-- LEFT JOIN for QMRL status
LEFT JOIN status_config AS qmrl_status
  ON qmrl.status_id = qmrl_status.id

-- LEFT JOIN for QMRL requester
LEFT JOIN users AS qmrl_requester
  ON qmrl.requester_id = qmrl_requester.id

-- LEFT JOIN for QMRL assigned_to
LEFT JOIN users AS qmrl_assigned
  ON qmrl.assigned_to = qmrl_assigned.id

-- LEFT JOIN for QMRL contact person
LEFT JOIN contact_persons AS qmrl_contact
  ON qmrl.contact_person_id = qmrl_contact.id

-- LEFT JOIN for QMHQ (may have 0 or many QMHQs per QMRL)
LEFT JOIN qmhq
  ON qmhq.qmrl_id = qmrl.id
  AND qmhq.is_active = true

-- LEFT JOIN for QMHQ status
LEFT JOIN status_config AS qmhq_status
  ON qmhq.status_id = qmhq_status.id

-- LEFT JOIN for QMHQ assigned_to
LEFT JOIN users AS qmhq_assigned
  ON qmhq.assigned_to = qmhq_assigned.id

-- LEFT JOIN for QMHQ contact person
LEFT JOIN contact_persons AS qmhq_contact
  ON qmhq.contact_person_id = qmhq_contact.id

-- LEFT JOIN for Purchase Orders (only for PO route QMHQs)
LEFT JOIN purchase_orders AS po
  ON po.qmhq_id = qmhq.id
  AND po.is_active = true

-- LEFT JOIN for PO supplier
LEFT JOIN suppliers AS supplier
  ON po.supplier_id = supplier.id

-- LEFT JOIN for Invoices (child of PO)
LEFT JOIN invoices AS invoice
  ON invoice.po_id = po.id
  AND invoice.is_active = true

-- LEFT JOIN for Stock-in Transactions (linked via invoice for PO route)
-- OPTIMIZATION: Separate join instead of OR condition enables index usage
LEFT JOIN inventory_transactions AS stock_in_trans
  ON stock_in_trans.invoice_id = invoice.id
  AND stock_in_trans.is_active = true

-- LEFT JOIN for Stock-out Transactions (linked via qmhq for item route)
-- OPTIMIZATION: Separate join instead of OR condition enables index usage
LEFT JOIN inventory_transactions AS stock_out_trans
  ON stock_out_trans.qmhq_id = qmhq.id
  AND stock_out_trans.is_active = true

-- LEFT JOIN for Financial Transactions (expense route)
LEFT JOIN financial_transactions AS fin_trans
  ON fin_trans.qmhq_id = qmhq.id
  AND fin_trans.is_active = true

-- LEFT JOIN for Stock-Out Requests (item route)
LEFT JOIN stock_out_requests AS sor
  ON sor.qmhq_id = qmhq.id
  AND sor.is_active = true

WHERE qmrl.is_active = true;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON qmrl_flow_chain TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW qmrl_flow_chain IS 'Flow tracking VIEW that joins QMRL -> QMHQ -> PO -> Invoice -> Stock + Financial Transactions for end-to-end visualization. Optimized with partial indexes and eliminated OR join for production-scale performance.';
