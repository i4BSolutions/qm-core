-- Migration: 20260211140000_flow_tracking_view.sql
-- Description: Create flow tracking VIEW for end-to-end QMRL chain visualization
-- Dependencies: qmrl, qmhq, purchase_orders, invoices, inventory_transactions, financial_transactions, stock_out_requests
-- Phase: 39-end-to-end-flow-tracking
-- Plan: 39-01

-- ============================================================================
-- FLOW TRACKING VIEW
-- ============================================================================
-- This VIEW joins the full QMRL downstream chain for flow tracking UI:
-- QMRL -> QMHQs -> (POs -> Invoices -> Stock Transactions) | Financial Transactions | Stock Transactions | Stock-Out Requests
--
-- The VIEW returns flat rows with many NULL columns due to LEFT JOINs.
-- The query function (lib/supabase/flow-tracking-queries.ts) transforms these into nested tree structure.

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

  -- Inventory Transaction fields (can be linked to invoice OR qmhq)
  inv_trans.id AS stock_id,
  inv_trans.movement_type AS stock_movement_type,
  inv_trans.status AS stock_status,
  inv_trans.transaction_date AS stock_transaction_date,
  inv_trans.created_at AS stock_created_at,

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

-- LEFT JOIN for Inventory Transactions
-- Can be linked via invoice_id (PO route stock-in) OR qmhq_id (item route stock-out)
LEFT JOIN inventory_transactions AS inv_trans
  ON (inv_trans.invoice_id = invoice.id OR inv_trans.qmhq_id = qmhq.id)
  AND inv_trans.is_active = true

-- LEFT JOIN for Financial Transactions (expense route)
LEFT JOIN financial_transactions AS fin_trans
  ON fin_trans.qmhq_id = qmhq.id
  AND fin_trans.is_active = true

-- LEFT JOIN for Stock-Out Requests (item route)
LEFT JOIN stock_out_requests AS sor
  ON sor.qmhq_id = qmhq.id
  AND sor.is_active = true

WHERE qmrl.is_active = true

ORDER BY
  qmrl.created_at DESC,
  qmhq.created_at,
  po.po_date,
  invoice.invoice_date;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON qmrl_flow_chain TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW qmrl_flow_chain IS 'Flow tracking VIEW that joins QMRL -> QMHQ -> PO -> Invoice -> Stock + Financial Transactions for end-to-end visualization';
