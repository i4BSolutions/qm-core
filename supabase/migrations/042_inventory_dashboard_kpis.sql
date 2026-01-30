-- Migration: 042_inventory_dashboard_kpis.sql
-- Description: Create RPC function for inventory dashboard KPI aggregations
-- Date: 2026-01-30

-- ============================================
-- Function: get_inventory_kpis
-- ============================================
-- Returns inventory transaction aggregates for dashboard KPIs
-- Filters on is_active = true AND status = 'completed'
-- Uses conditional aggregation for stock in/out metrics
-- ============================================
CREATE OR REPLACE FUNCTION public.get_inventory_kpis(
  from_date date DEFAULT NULL,
  to_date date DEFAULT NULL,
  warehouse_id_filter uuid DEFAULT NULL,
  item_id_filter uuid DEFAULT NULL
)
RETURNS TABLE(
  stock_in_count bigint,
  stock_in_value_eusd numeric,
  stock_out_count bigint,
  stock_out_value_eusd numeric,
  net_movement_eusd numeric
) AS $$
  SELECT
    -- Stock in aggregates
    COUNT(*) FILTER (WHERE movement_type = 'inventory_in') as stock_in_count,
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_in'), 0) as stock_in_value_eusd,

    -- Stock out aggregates
    COUNT(*) FILTER (WHERE movement_type = 'inventory_out') as stock_out_count,
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_out'), 0) as stock_out_value_eusd,

    -- Net movement (in - out)
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_in'), 0) -
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_out'), 0) as net_movement_eusd
  FROM public.inventory_transactions
  WHERE
    is_active = true
    AND status = 'completed'
    AND (from_date IS NULL OR transaction_date >= from_date)
    AND (to_date IS NULL OR transaction_date <= to_date)
    AND (warehouse_id_filter IS NULL OR warehouse_id = warehouse_id_filter)
    AND (item_id_filter IS NULL OR item_id = item_id_filter);
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public;

COMMENT ON FUNCTION public.get_inventory_kpis IS 'Returns inventory transaction KPIs for dashboard with optional date and entity filters';

-- ============================================
-- Grant execute permissions to authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_inventory_kpis(date, date, uuid, uuid) TO authenticated;
