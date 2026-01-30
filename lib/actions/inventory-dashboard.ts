"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================
// Types
// ============================================

export interface InventoryKPIs {
  stock_in_count: number;
  stock_in_value_eusd: number;
  stock_out_count: number;
  stock_out_value_eusd: number;
  net_movement_eusd: number;
}

export interface InventoryKPIFilters {
  fromDate?: string;
  toDate?: string;
  warehouseId?: string;
  itemId?: string;
}

export interface InventoryTransaction {
  id: string;
  transaction_date: string;
  movement_type: "inventory_in" | "inventory_out";
  quantity: number;
  unit_cost: number | null;
  currency: string;
  exchange_rate: number;
  total_cost: number | null;
  total_cost_eusd: number | null;
  reference_no: string | null;
  invoice_id: string | null;
  qmhq_id: string | null;
  item: {
    id: string;
    name: string;
    sku: string;
  } | null;
  warehouse: {
    id: string;
    name: string;
  } | null;
  invoice: {
    id: string;
    invoice_number: string;
  } | null;
  qmhq: {
    id: string;
    request_id: string;
  } | null;
}

export interface InventoryTransactionFilters {
  fromDate?: string;
  toDate?: string;
  warehouseId?: string;
  itemId?: string;
  movementType?: "inventory_in" | "inventory_out" | "all";
  page: number;
  pageSize: number;
}

export interface InventoryTransactionsResult {
  transactions: InventoryTransaction[];
  totalCount: number;
}

// ============================================
// Server Actions
// ============================================

/**
 * Get inventory KPIs for dashboard
 * Uses RPC function for efficient server-side aggregation
 */
export async function getInventoryKPIs(
  filters: InventoryKPIFilters = {}
): Promise<InventoryKPIs> {
  const supabase = await createClient();

  // Type assertion for RPC call - will be properly typed after type generation
  const { data, error } = await supabase.rpc("get_inventory_kpis" as any, {
    from_date: filters.fromDate || null,
    to_date: filters.toDate || null,
    warehouse_id_filter: filters.warehouseId || null,
    item_id_filter: filters.itemId || null,
  });

  if (error) {
    console.error("Error fetching inventory KPIs:", error);
    throw new Error(`Failed to fetch inventory KPIs: ${error.message}`);
  }

  // RPC returns array with single row
  const result = (data as any)?.[0] || {
    stock_in_count: 0,
    stock_in_value_eusd: 0,
    stock_out_count: 0,
    stock_out_value_eusd: 0,
    net_movement_eusd: 0,
  };

  return {
    stock_in_count: Number(result.stock_in_count),
    stock_in_value_eusd: Number(result.stock_in_value_eusd),
    stock_out_count: Number(result.stock_out_count),
    stock_out_value_eusd: Number(result.stock_out_value_eusd),
    net_movement_eusd: Number(result.net_movement_eusd),
  };
}

/**
 * Get paginated inventory transactions with filters
 * Includes joins for item, warehouse, invoice, and qmhq details
 */
export async function getInventoryTransactions(
  filters: InventoryTransactionFilters
): Promise<InventoryTransactionsResult> {
  const supabase = await createClient();

  // Build query with filters
  let query = supabase
    .from("inventory_transactions")
    .select(
      `
      id,
      transaction_date,
      movement_type,
      quantity,
      unit_cost,
      currency,
      exchange_rate,
      total_cost,
      total_cost_eusd,
      reference_no,
      invoice_id,
      qmhq_id,
      item:items(id, name, sku),
      warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
      invoice:invoices(id, invoice_number),
      qmhq:qmhq(id, request_id)
    `,
      { count: "exact" }
    )
    .eq("is_active", true)
    .eq("status", "completed");

  // Apply filters
  if (filters.fromDate) {
    query = query.gte("transaction_date", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("transaction_date", filters.toDate);
  }
  if (filters.warehouseId) {
    query = query.eq("warehouse_id", filters.warehouseId);
  }
  if (filters.itemId) {
    query = query.eq("item_id", filters.itemId);
  }
  if (filters.movementType && filters.movementType !== "all") {
    query = query.eq("movement_type", filters.movementType);
  }

  // Order by date (newest first)
  query = query.order("transaction_date", { ascending: false });

  // Apply pagination
  const startIndex = (filters.page - 1) * filters.pageSize;
  const endIndex = startIndex + filters.pageSize - 1;
  query = query.range(startIndex, endIndex);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching inventory transactions:", error);
    throw new Error(`Failed to fetch inventory transactions: ${error.message}`);
  }

  return {
    transactions: (data as any as InventoryTransaction[]) || [],
    totalCount: count || 0,
  };
}
