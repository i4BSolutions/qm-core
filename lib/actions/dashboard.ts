'use server';

/**
 * Dashboard Server Actions
 *
 * Server actions for fetching dashboard data with parallel fetching
 * to avoid sequential query waterfalls.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Dashboard data returned by getDashboardData
 */
export interface DashboardData {
  qmrlStats: { status_group: string; count: number }[];
  qmhqStats: { status_group: string; count: number }[];
  lowStockAlerts: Array<{
    item_id: string;
    item_name: string;
    item_sku: string;
    warehouse_id: string;
    warehouse_name: string;
    current_stock: number;
    severity: 'out_of_stock' | 'critical' | 'warning';
  }>;
  recentAudits: Array<{
    id: string;
    action: string;
    entity_type: string;
    changes_summary: string | null;
    changed_by_name: string | null;
    changed_at: string;
  }>;
  recentStockMovements: Array<{
    id: string;
    movement_type: 'inventory_in' | 'inventory_out';
    item_name: string | null;
    quantity: number;
    warehouse_name: string;
    transaction_date: string;
    created_by_name: string;
  }>;
}

/**
 * Fetches all dashboard data in parallel for optimal performance.
 *
 * Uses Promise.all to execute all queries simultaneously,
 * avoiding sequential waterfall patterns.
 *
 * @returns DashboardData with all 5 data types
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  // Initiate all requests BEFORE any await (parallel fetching pattern)
  const qmrlStatsPromise = supabase.rpc('get_qmrl_status_counts');
  const qmhqStatsPromise = supabase.rpc('get_qmhq_status_counts');
  const lowStockPromise = supabase.rpc('get_low_stock_alerts', { threshold: 10 });

  const recentAuditsPromise = supabase
    .from('audit_logs')
    .select('id, action, entity_type, changes_summary, changed_by_name, changed_at')
    .order('changed_at', { ascending: false })
    .limit(5);

  const recentStockPromise = supabase
    .from('inventory_transactions')
    .select(`
      id,
      movement_type,
      item_name,
      quantity,
      transaction_date,
      warehouse_id,
      created_by
    `)
    .eq('status', 'completed')
    .eq('is_active', true)
    .order('transaction_date', { ascending: false })
    .limit(10);

  // Separate queries for warehouse and user names (avoids relationship ambiguity)
  const warehousesPromise = supabase
    .from('warehouses')
    .select('id, name')
    .eq('is_active', true);

  const usersPromise = supabase
    .from('users')
    .select('id, full_name');

  // Await all together using Promise.all
  const [qmrlStats, qmhqStats, lowStock, audits, stockMovements, warehouses, users] = await Promise.all([
    qmrlStatsPromise,
    qmhqStatsPromise,
    lowStockPromise,
    recentAuditsPromise,
    recentStockPromise,
    warehousesPromise,
    usersPromise,
  ]);

  // Create lookup maps for warehouse and user names
  const warehouseMap = new Map(
    (warehouses.data || []).map(w => [w.id, w.name])
  );
  const userMap = new Map(
    (users.data || []).map(u => [u.id, u.full_name])
  );

  // Transform stock movements with lookup
  const transformedStockMovements = (stockMovements.data || []).map((m) => ({
    id: m.id,
    movement_type: m.movement_type as 'inventory_in' | 'inventory_out',
    item_name: m.item_name,
    quantity: Number(m.quantity),
    warehouse_name: m.warehouse_id ? warehouseMap.get(m.warehouse_id) || 'Unknown' : 'Unknown',
    transaction_date: m.transaction_date || new Date().toISOString().split('T')[0],
    created_by_name: m.created_by ? userMap.get(m.created_by) || 'System' : 'System',
  }));

  // Transform low stock alerts to ensure correct severity type
  const transformedLowStockAlerts = (lowStock.data || []).map((alert) => ({
    ...alert,
    severity: alert.severity as 'out_of_stock' | 'critical' | 'warning',
  }));

  return {
    qmrlStats: qmrlStats.data || [],
    qmhqStats: qmhqStats.data || [],
    lowStockAlerts: transformedLowStockAlerts,
    recentAudits: audits.data || [],
    recentStockMovements: transformedStockMovements,
  };
}
