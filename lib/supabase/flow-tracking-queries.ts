/**
 * Flow Tracking Queries
 *
 * Query functions for fetching and transforming flow tracking data.
 * Fetches flat rows from qmrl_flow_chain VIEW and transforms into nested tree structure.
 *
 * Phase: 39-end-to-end-flow-tracking
 * Plan: 39-01
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  FlowChain,
  FlowQMRL,
  FlowQMHQ,
  FlowPO,
  FlowInvoice,
  FlowStockTransaction,
  FlowFinancialTransaction,
  FlowStockOutRequest,
  FlowPerson,
  FlowStatus,
} from '@/types/flow-tracking';

/**
 * Fetch flow chain by QMRL request_id
 *
 * Queries the qmrl_flow_chain VIEW and transforms flat rows into nested tree structure.
 *
 * @param supabase - Supabase client instance
 * @param qmrlRequestId - QMRL request_id (e.g., "QMRL-2026-00001")
 * @returns FlowChain data or null if not found, with error message if query fails
 */
export async function fetchFlowChain(
  supabase: SupabaseClient,
  qmrlRequestId: string
): Promise<{ data: FlowChain | null; error: string | null }> {
  // Normalize request ID (uppercase, trim whitespace)
  const normalizedId = qmrlRequestId.toUpperCase().trim();

  // Query the VIEW
  const { data: rows, error } = await supabase
    .from('qmrl_flow_chain')
    .select('*')
    .eq('qmrl_request_id', normalizedId);

  // Handle query error
  if (error) {
    return { data: null, error: error.message };
  }

  // Handle not found (no rows returned)
  if (!rows || rows.length === 0) {
    return { data: null, error: null };
  }

  // Transform flat rows into nested tree structure
  const flowChain = transformRowsToFlowChain(rows);

  return { data: flowChain, error: null };
}

/**
 * Transform flat VIEW rows into nested FlowChain structure
 *
 * The VIEW returns flat rows with many NULL columns due to LEFT JOINs.
 * This function deduplicates and nests entities using Map-based grouping.
 *
 * Algorithm:
 * 1. Extract QMRL data from first row (all rows have same QMRL)
 * 2. For each row, deduplicate and nest:
 *    - QMHQ (if qmhq_id exists)
 *    - PO (if po_id exists, under QMHQ)
 *    - Invoice (if invoice_id exists, under PO)
 *    - Stock Transaction (if stock_id exists, under Invoice or QMHQ)
 *    - Financial Transaction (if ft_id exists, under QMHQ)
 *    - Stock-Out Request (if sor_id exists, under QMHQ)
 * 3. Return FlowQMRL with nested qmhqs array
 */
function transformRowsToFlowChain(rows: any[]): FlowChain {
  // Extract QMRL data from first row (all rows have identical QMRL data)
  const firstRow = rows[0];

  // Build QMRL status
  const qmrlStatus: FlowStatus = {
    name: firstRow.qmrl_status_name || 'Unknown',
    color: firstRow.qmrl_status_color || '#9CA3AF',
  };

  // Build QMRL requester
  const qmrlRequester: FlowPerson | null = firstRow.qmrl_requester_id
    ? {
        id: firstRow.qmrl_requester_id,
        full_name: firstRow.qmrl_requester_full_name || 'Unknown',
        avatar_url: firstRow.qmrl_requester_avatar_url || null,
      }
    : null;

  // Build QMRL assigned_to
  const qmrlAssigned: FlowPerson | null = firstRow.qmrl_assigned_id
    ? {
        id: firstRow.qmrl_assigned_id,
        full_name: firstRow.qmrl_assigned_full_name || 'Unknown',
        avatar_url: firstRow.qmrl_assigned_avatar_url || null,
      }
    : null;

  // Initialize QMRL structure
  const qmrl: FlowQMRL = {
    id: firstRow.qmrl_id,
    request_id: firstRow.qmrl_request_id,
    title: firstRow.qmrl_title,
    priority: firstRow.qmrl_priority,
    request_date: firstRow.qmrl_request_date,
    created_at: firstRow.qmrl_created_at,
    status: qmrlStatus,
    requester: qmrlRequester,
    assigned_to: qmrlAssigned,
    contact_person_name: firstRow.qmrl_contact_person_name || null,
    qmhqs: [],
  };

  // Maps for deduplication (keyed by UUID)
  const qmhqMap = new Map<string, FlowQMHQ>();

  // Process each row to build nested structure
  for (const row of rows) {
    // Skip if no QMHQ in this row (QMRL with zero QMHQs case)
    if (!row.qmhq_id) {
      continue;
    }

    // ========================================================================
    // QMHQ LEVEL
    // ========================================================================
    let qmhq = qmhqMap.get(row.qmhq_id);

    if (!qmhq) {
      // Build QMHQ status
      const qmhqStatus: FlowStatus = {
        name: row.qmhq_status_name || 'Unknown',
        color: row.qmhq_status_color || '#9CA3AF',
      };

      // Build QMHQ assigned_to
      const qmhqAssigned: FlowPerson | null = row.qmhq_assigned_id
        ? {
            id: row.qmhq_assigned_id,
            full_name: row.qmhq_assigned_full_name || 'Unknown',
            avatar_url: row.qmhq_assigned_avatar_url || null,
          }
        : null;

      // Create new QMHQ
      qmhq = {
        id: row.qmhq_id,
        request_id: row.qmhq_request_id,
        line_name: row.qmhq_line_name,
        route_type: row.qmhq_route_type,
        status: qmhqStatus,
        assigned_to: qmhqAssigned,
        contact_person_name: row.qmhq_contact_person_name || null,
        created_at: row.qmhq_created_at,
        pos: [],
        financial_transactions: [],
        stock_transactions: [],
        stock_out_requests: [],
      };

      qmhqMap.set(row.qmhq_id, qmhq);
    }

    // ========================================================================
    // PO LEVEL (only for PO route)
    // ========================================================================
    if (row.po_id) {
      let po = qmhq.pos.find((p) => p.id === row.po_id);

      if (!po) {
        // Create new PO
        po = {
          id: row.po_id,
          po_number: row.po_po_number,
          status: row.po_status,
          po_date: row.po_po_date,
          expected_delivery_date: row.po_expected_delivery_date || null,
          created_at: row.po_created_at,
          supplier_name: row.po_supplier_name || null,
          is_cancelled: row.po_status === 'cancelled',
          invoices: [],
        };

        qmhq.pos.push(po);
      }

      // ======================================================================
      // INVOICE LEVEL (child of PO)
      // ======================================================================
      if (row.invoice_id) {
        let invoice = po.invoices.find((inv) => inv.id === row.invoice_id);

        if (!invoice) {
          // Create new Invoice
          invoice = {
            id: row.invoice_id,
            invoice_number: row.invoice_invoice_number,
            status: row.invoice_status,
            invoice_date: row.invoice_invoice_date,
            due_date: row.invoice_due_date || null,
            is_voided: row.invoice_is_voided || false,
            created_at: row.invoice_created_at,
            stock_transactions: [],
          };

          po.invoices.push(invoice);
        }

        // ====================================================================
        // STOCK TRANSACTION LEVEL (child of Invoice, for PO route stock-in)
        // ====================================================================
        if (row.stock_id && row.invoice_id) {
          // Only add if not already in invoice's stock_transactions
          const alreadyAdded = invoice.stock_transactions.some(
            (st) => st.id === row.stock_id
          );

          if (!alreadyAdded) {
            const stockTransaction: FlowStockTransaction = {
              id: row.stock_id,
              movement_type: row.stock_movement_type,
              status: row.stock_status,
              transaction_date: row.stock_transaction_date,
              created_at: row.stock_created_at,
            };

            invoice.stock_transactions.push(stockTransaction);
          }
        }
      }
    }

    // ========================================================================
    // FINANCIAL TRANSACTION LEVEL (child of QMHQ, for expense route)
    // ========================================================================
    if (row.ft_id) {
      const alreadyAdded = qmhq.financial_transactions.some(
        (ft) => ft.id === row.ft_id
      );

      if (!alreadyAdded) {
        const financialTransaction: FlowFinancialTransaction = {
          id: row.ft_id,
          transaction_type: row.ft_transaction_type,
          transaction_date: row.ft_transaction_date,
          created_at: row.ft_created_at,
          is_voided: row.ft_is_voided || false,
        };

        qmhq.financial_transactions.push(financialTransaction);
      }
    }

    // ========================================================================
    // STOCK TRANSACTION LEVEL (child of QMHQ, for item route stock-out)
    // ========================================================================
    if (row.stock_id && row.qmhq_id && !row.invoice_id) {
      // Only add if linked to QMHQ (not invoice) - item route stock-out
      const alreadyAdded = qmhq.stock_transactions.some(
        (st) => st.id === row.stock_id
      );

      if (!alreadyAdded) {
        const stockTransaction: FlowStockTransaction = {
          id: row.stock_id,
          movement_type: row.stock_movement_type,
          status: row.stock_status,
          transaction_date: row.stock_transaction_date,
          created_at: row.stock_created_at,
        };

        qmhq.stock_transactions.push(stockTransaction);
      }
    }

    // ========================================================================
    // STOCK-OUT REQUEST LEVEL (child of QMHQ, for item route)
    // ========================================================================
    if (row.sor_id) {
      const alreadyAdded = qmhq.stock_out_requests.some(
        (sor) => sor.id === row.sor_id
      );

      if (!alreadyAdded) {
        const stockOutRequest: FlowStockOutRequest = {
          id: row.sor_id,
          request_number: row.sor_request_number,
          status: row.sor_status,
          created_at: row.sor_created_at,
        };

        qmhq.stock_out_requests.push(stockOutRequest);
      }
    }
  }

  // Convert qmhqMap to array and assign to QMRL
  qmrl.qmhqs = Array.from(qmhqMap.values());

  return qmrl;
}
