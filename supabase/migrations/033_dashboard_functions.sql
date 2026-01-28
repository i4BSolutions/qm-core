-- Migration: 033_dashboard_functions.sql
-- Description: Create RPC functions for dashboard aggregations
-- Date: 2026-01-28

-- ============================================
-- Dashboard RPC Functions
-- ============================================
-- These functions provide efficient server-side aggregations
-- for the management dashboard KPIs and alerts.
-- ============================================

-- ============================================
-- Function: get_qmrl_status_counts
-- ============================================
-- Returns QMRL counts grouped by status_group (to_do, in_progress, done)
-- Uses LEFT JOIN to include status groups with 0 counts
-- ============================================
CREATE OR REPLACE FUNCTION public.get_qmrl_status_counts()
RETURNS TABLE(
  status_group text,
  count bigint
) AS $$
  SELECT
    sc.status_group::text,
    COUNT(q.id) as count
  FROM public.status_config sc
  LEFT JOIN public.qmrl q ON q.status_id = sc.id AND q.is_active = true
  WHERE sc.entity_type = 'qmrl' AND sc.is_active = true
  GROUP BY sc.status_group
  ORDER BY
    CASE sc.status_group
      WHEN 'to_do' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'done' THEN 3
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_qmrl_status_counts IS 'Returns QMRL counts grouped by status_group for dashboard KPIs';

-- ============================================
-- Function: get_qmhq_status_counts
-- ============================================
-- Returns QMHQ counts grouped by status_group (to_do, in_progress, done)
-- Uses LEFT JOIN to include status groups with 0 counts
-- ============================================
CREATE OR REPLACE FUNCTION public.get_qmhq_status_counts()
RETURNS TABLE(
  status_group text,
  count bigint
) AS $$
  SELECT
    sc.status_group::text,
    COUNT(q.id) as count
  FROM public.status_config sc
  LEFT JOIN public.qmhq q ON q.status_id = sc.id AND q.is_active = true
  WHERE sc.entity_type = 'qmhq' AND sc.is_active = true
  GROUP BY sc.status_group
  ORDER BY
    CASE sc.status_group
      WHEN 'to_do' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'done' THEN 3
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_qmhq_status_counts IS 'Returns QMHQ counts grouped by status_group for dashboard KPIs';

-- ============================================
-- Function: get_low_stock_alerts
-- ============================================
-- Returns items with stock at or below threshold with severity levels:
--   - out_of_stock: stock = 0
--   - critical: stock 1-4
--   - warning: stock 5-threshold (default 10)
-- Calculates stock from completed inventory_transactions
-- ============================================
CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(threshold integer DEFAULT 10)
RETURNS TABLE(
  item_id uuid,
  item_name text,
  item_sku text,
  warehouse_id uuid,
  warehouse_name text,
  current_stock numeric,
  severity text
) AS $$
  WITH stock_levels AS (
    SELECT
      it.item_id,
      it.warehouse_id,
      SUM(CASE WHEN it.movement_type = 'inventory_in' THEN it.quantity ELSE 0 END) -
      SUM(CASE WHEN it.movement_type = 'inventory_out' THEN it.quantity ELSE 0 END) as stock
    FROM public.inventory_transactions it
    WHERE it.status = 'completed' AND it.is_active = true
    GROUP BY it.item_id, it.warehouse_id
  )
  SELECT
    i.id as item_id,
    i.name as item_name,
    i.sku as item_sku,
    w.id as warehouse_id,
    w.name as warehouse_name,
    sl.stock as current_stock,
    CASE
      WHEN sl.stock = 0 THEN 'out_of_stock'
      WHEN sl.stock <= 4 THEN 'critical'
      WHEN sl.stock <= threshold THEN 'warning'
      ELSE 'normal'
    END as severity
  FROM stock_levels sl
  JOIN public.items i ON i.id = sl.item_id
  JOIN public.warehouses w ON w.id = sl.warehouse_id
  WHERE sl.stock <= threshold AND i.is_active = true AND w.is_active = true
  ORDER BY
    CASE
      WHEN sl.stock = 0 THEN 1
      WHEN sl.stock <= 4 THEN 2
      ELSE 3
    END,
    i.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_low_stock_alerts IS 'Returns items with low stock levels for dashboard alerts';

-- ============================================
-- Grant execute permissions to authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_qmrl_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_qmhq_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(integer) TO authenticated;
