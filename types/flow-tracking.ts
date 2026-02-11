/**
 * Flow Tracking Types
 *
 * Type definitions for the end-to-end flow tracking feature.
 * Models the nested chain structure: QMRL -> QMHQs -> (POs -> Invoices -> Stock) | Financial Transactions | Stock Transactions | Stock-Out Requests
 *
 * These types are used by:
 * - lib/supabase/flow-tracking-queries.ts (query and transformation logic)
 * - Flow tracking UI components (Phase 39 Plan 02)
 */

// ============================================================================
// PERSON AND STATUS DISPLAY TYPES
// ============================================================================

/**
 * Person display type (for users with avatars)
 * Used for requester, assigned_to fields
 */
export interface FlowPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Status display type
 * Includes name and color for badge rendering
 */
export interface FlowStatus {
  name: string;
  color: string;
}

// ============================================================================
// LEAF NODE TYPES (bottom of the chain)
// ============================================================================

/**
 * Stock Transaction (inventory_transactions table)
 * Can be linked to:
 * - Invoice (PO route: stock-in from invoice)
 * - QMHQ (item route: stock-out from warehouse)
 */
export interface FlowStockTransaction {
  id: string;
  movement_type: string; // 'inventory_in' | 'inventory_out'
  status: string;
  transaction_date: string;
  created_at: string;
}

/**
 * Financial Transaction (financial_transactions table)
 * Linked to QMHQ for expense route
 */
export interface FlowFinancialTransaction {
  id: string;
  transaction_type: string; // 'money_in' | 'money_out'
  transaction_date: string;
  created_at: string;
  is_voided: boolean;
}

/**
 * Stock-Out Request (stock_out_requests table)
 * Linked to QMHQ for item route
 */
export interface FlowStockOutRequest {
  id: string;
  request_number: string;
  status: string; // sor_request_status enum
  created_at: string;
}

// ============================================================================
// INVOICE TYPE (child of PO)
// ============================================================================

/**
 * Invoice (invoices table)
 * Child of Purchase Order
 * Contains stock_transactions array for PO route stock-in
 */
export interface FlowInvoice {
  id: string;
  invoice_number: string;
  status: string; // invoice_status enum
  invoice_date: string;
  due_date: string | null;
  is_voided: boolean;
  created_at: string;
  stock_transactions: FlowStockTransaction[]; // Stock-in from this invoice
}

// ============================================================================
// PURCHASE ORDER TYPE (child of QMHQ)
// ============================================================================

/**
 * Purchase Order (purchase_orders table)
 * Child of QMHQ (only for PO route)
 * Contains invoices array
 */
export interface FlowPO {
  id: string;
  po_number: string;
  status: string; // po_status enum
  po_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  supplier_name: string | null;
  is_cancelled: boolean; // Computed from status = 'cancelled'
  invoices: FlowInvoice[]; // Invoices under this PO
}

// ============================================================================
// QMHQ TYPE (child of QMRL)
// ============================================================================

/**
 * QMHQ (qmhq table)
 * Child of QMRL
 * Contains route-specific children based on route_type:
 * - 'po': pos array
 * - 'expense': financial_transactions array
 * - 'item': stock_transactions array, stock_out_requests array
 */
export interface FlowQMHQ {
  id: string;
  request_id: string;
  line_name: string;
  route_type: 'item' | 'expense' | 'po';
  status: FlowStatus;
  assigned_to: FlowPerson | null;
  contact_person_name: string | null;
  created_at: string;

  // Route-specific children
  pos: FlowPO[]; // Only populated for route_type = 'po'
  financial_transactions: FlowFinancialTransaction[]; // Only populated for route_type = 'expense'
  stock_transactions: FlowStockTransaction[]; // Only populated for route_type = 'item' (stock-out)
  stock_out_requests: FlowStockOutRequest[]; // Only populated for route_type = 'item'
}

// ============================================================================
// QMRL TYPE (root of the chain)
// ============================================================================

/**
 * QMRL (qmrl table)
 * Root entity of the flow chain
 * Contains qmhqs array with all downstream entities
 */
export interface FlowQMRL {
  id: string;
  request_id: string;
  title: string;
  priority: string; // 'low' | 'medium' | 'high' | 'critical'
  request_date: string;
  created_at: string;
  status: FlowStatus;
  requester: FlowPerson | null;
  assigned_to: FlowPerson | null;
  contact_person_name: string | null;
  qmhqs: FlowQMHQ[]; // All QMHQs under this QMRL with their downstream chains
}

// ============================================================================
// FLOW CHAIN TYPE (alias for FlowQMRL)
// ============================================================================

/**
 * FlowChain type (alias for FlowQMRL)
 * The complete flow tracking chain starting from a QMRL
 */
export type FlowChain = FlowQMRL;
