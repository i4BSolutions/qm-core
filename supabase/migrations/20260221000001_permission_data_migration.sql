-- Migration: 20260221000001_permission_data_migration
-- Phase: 59 - Permission Schema & Migration
-- Description: Backfill all existing users with 16 permission rows each,
--              derived from their current users.role value.
--
-- Role → Permission mapping (from 59-CONTEXT.md):
--
--   admin  → Edit on all 16 resources
--
--   qmrl   → Edit on: system_dashboard, qmrl, qmhq
--             View on: po, invoice, warehouse, item
--             Block on: money_transactions, inv_transactions, stock_in, sor,
--                       sor_l1, sor_l2, sor_l3, inventory_dashboard, admin
--
--   qmhq   → Edit on: qmhq, money_transactions, inv_transactions, po, invoice,
--                      stock_in, sor, sor_l1, sor_l2, sor_l3, warehouse,
--                      inventory_dashboard, item
--             View on: system_dashboard, qmrl
--             Block on: admin
--
--   NULL/unknown → View on system_dashboard only, Block on everything else
--
--   inactive users → Block on all 16 resources
--
-- This migration is idempotent (ON CONFLICT DO NOTHING) and safe to re-run.
-- A validation block at the end ensures every user has exactly 16 rows.
--
-- Date: 2026-02-21

BEGIN;

-- ============================================
-- Part 1: Backfill active users with role-based permissions
-- Using a CTE that defines the complete role→resource→level mapping
-- as an inline VALUES list (48 rows: 3 roles × 16 resources).
-- ============================================

WITH role_permissions (role, resource, level) AS (
  VALUES
    -- -----------------------------------------------
    -- admin role: Edit on all 16 resources
    -- -----------------------------------------------
    ('admin'::public.user_role, 'system_dashboard'::public.permission_resource,  'edit'::public.permission_level),
    ('admin',                   'qmrl',                                           'edit'),
    ('admin',                   'qmhq',                                           'edit'),
    ('admin',                   'money_transactions',                              'edit'),
    ('admin',                   'inv_transactions',                                'edit'),
    ('admin',                   'po',                                              'edit'),
    ('admin',                   'invoice',                                         'edit'),
    ('admin',                   'stock_in',                                        'edit'),
    ('admin',                   'sor',                                             'edit'),
    ('admin',                   'sor_l1',                                          'edit'),
    ('admin',                   'sor_l2',                                          'edit'),
    ('admin',                   'sor_l3',                                          'edit'),
    ('admin',                   'warehouse',                                       'edit'),
    ('admin',                   'inventory_dashboard',                             'edit'),
    ('admin',                   'item',                                            'edit'),
    ('admin',                   'admin',                                           'edit'),

    -- -----------------------------------------------
    -- qmrl role: Field operations
    --   Edit: system_dashboard, qmrl, qmhq
    --   View: po, invoice, warehouse, item
    --   Block: money_transactions, inv_transactions, stock_in, sor,
    --          sor_l1, sor_l2, sor_l3, inventory_dashboard, admin
    -- -----------------------------------------------
    ('qmrl',                    'system_dashboard',                                'edit'),
    ('qmrl',                    'qmrl',                                            'edit'),
    ('qmrl',                    'qmhq',                                            'edit'),
    ('qmrl',                    'money_transactions',                              'block'),
    ('qmrl',                    'inv_transactions',                                'block'),
    ('qmrl',                    'po',                                              'view'),
    ('qmrl',                    'invoice',                                         'view'),
    ('qmrl',                    'stock_in',                                        'block'),
    ('qmrl',                    'sor',                                             'block'),
    ('qmrl',                    'sor_l1',                                          'block'),
    ('qmrl',                    'sor_l2',                                          'block'),
    ('qmrl',                    'sor_l3',                                          'block'),
    ('qmrl',                    'warehouse',                                       'view'),
    ('qmrl',                    'inventory_dashboard',                             'block'),
    ('qmrl',                    'item',                                            'view'),
    ('qmrl',                    'admin',                                           'block'),

    -- -----------------------------------------------
    -- qmhq role: HQ operations
    --   Edit: qmhq, money_transactions, inv_transactions, po, invoice,
    --         stock_in, sor, sor_l1, sor_l2, sor_l3, warehouse,
    --         inventory_dashboard, item
    --   View: system_dashboard, qmrl
    --   Block: admin
    -- -----------------------------------------------
    ('qmhq',                    'system_dashboard',                                'view'),
    ('qmhq',                    'qmrl',                                            'view'),
    ('qmhq',                    'qmhq',                                            'edit'),
    ('qmhq',                    'money_transactions',                              'edit'),
    ('qmhq',                    'inv_transactions',                                'edit'),
    ('qmhq',                    'po',                                              'edit'),
    ('qmhq',                    'invoice',                                         'edit'),
    ('qmhq',                    'stock_in',                                        'edit'),
    ('qmhq',                    'sor',                                             'edit'),
    ('qmhq',                    'sor_l1',                                          'edit'),
    ('qmhq',                    'sor_l2',                                          'edit'),
    ('qmhq',                    'sor_l3',                                          'edit'),
    ('qmhq',                    'warehouse',                                       'edit'),
    ('qmhq',                    'inventory_dashboard',                             'edit'),
    ('qmhq',                    'item',                                            'edit'),
    ('qmhq',                    'admin',                                           'block')
)
INSERT INTO public.user_permissions (user_id, resource, level)
SELECT
  u.id,
  rp.resource::public.permission_resource,
  rp.level::public.permission_level
FROM public.users u
JOIN role_permissions rp ON u.role::text = rp.role::text
WHERE u.is_active = true
ON CONFLICT (user_id, resource) DO NOTHING;

-- ============================================
-- Part 2: Inactive users → Block on all 16 resources
-- They still need permission rows for data integrity.
-- ============================================
INSERT INTO public.user_permissions (user_id, resource, level)
SELECT
  u.id,
  r,
  'block'::public.permission_level
FROM public.users u
CROSS JOIN unnest(enum_range(NULL::public.permission_resource)) AS r
WHERE u.is_active = false
ON CONFLICT (user_id, resource) DO NOTHING;

-- ============================================
-- Part 3: Fallback for NULL or unexpected role values
-- View on system_dashboard only, Block on everything else.
-- Admin must explicitly grant permissions after migration.
-- ============================================
INSERT INTO public.user_permissions (user_id, resource, level)
SELECT
  u.id,
  r,
  CASE
    WHEN r = 'system_dashboard'::public.permission_resource
    THEN 'view'::public.permission_level
    ELSE 'block'::public.permission_level
  END
FROM public.users u
CROSS JOIN unnest(enum_range(NULL::public.permission_resource)) AS r
WHERE u.role IS NULL
ON CONFLICT (user_id, resource) DO NOTHING;

-- ============================================
-- Part 4: Validation — every user must have exactly 16 rows
-- Aborts the transaction if any user is under-provisioned.
-- ============================================
DO $$
DECLARE
  user_count    INTEGER;
  perm_count    INTEGER;
  expected      INTEGER;
  resource_count INTEGER;
BEGIN
  -- Confirm enum has exactly 16 values
  SELECT COUNT(*) INTO resource_count
  FROM unnest(enum_range(NULL::public.permission_resource));

  IF resource_count != 16 THEN
    RAISE EXCEPTION
      'permission_resource enum has % values, expected 16. '
      'Update this migration if new resources were added.',
      resource_count;
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.users;
  SELECT COUNT(*) INTO perm_count FROM public.user_permissions;
  expected := user_count * 16;

  IF perm_count < expected THEN
    RAISE EXCEPTION
      'Permission migration incomplete: expected % rows (% users × 16), got %. '
      'Some users are missing permission rows. Rolling back.',
      expected, user_count, perm_count;
  END IF;

  RAISE NOTICE 'Permission migration validated: % users × 16 resources = % rows (found %).',
    user_count, expected, perm_count;
END $$;

-- ============================================
-- Part 5: Audit log entry
-- ============================================
INSERT INTO public.audit_logs (
  entity_type,
  entity_id,
  action,
  changes_summary,
  old_values,
  new_values,
  changed_at
)
VALUES (
  'system',
  gen_random_uuid(),
  'update',
  'v1.13 permission migration: created user_permissions table with 16 resources per user',
  jsonb_build_object(
    'system', 'role-based access control (3 roles: admin, qmrl, qmhq)'
  ),
  jsonb_build_object(
    'system', 'per-user per-resource permission matrix (16 resources: edit/view/block)',
    'roles_migrated', jsonb_build_array('admin', 'qmrl', 'qmhq'),
    'admin_mapping',  'edit on all 16 resources',
    'qmrl_mapping',   'edit: dashboard/qmrl/qmhq; view: po/invoice/warehouse/item; block: rest',
    'qmhq_mapping',   'edit: qmhq/po/invoice/money/inv/stock/sor/warehouse/item; view: dashboard/qmrl; block: admin'
  ),
  NOW()
);

COMMIT;
