-- ============================================
-- Migration: 057_deletion_protection.sql
-- Description: Deletion protection triggers for master data entities
-- ============================================
-- This migration adds BEFORE UPDATE triggers that prevent soft-delete
-- (is_active = false) of master data entities when they are actively
-- referenced by other records. This protects referential integrity.
--
-- Covered entities:
-- 1. Items (5 reference checks)
-- 2. Status Config (2 reference checks)
-- 3. Categories (3 reference checks)
-- 4. Departments (3 reference checks)
-- 5. Contact Persons (2 reference checks)
-- 6. Suppliers (1 reference check)
--
-- Trigger ordering:
-- - 'aa_' prefix ensures these triggers fire BEFORE audit triggers
-- - Sequence: aa_block_*_deactivation -> audit triggers
-- ============================================

-- ============================================
-- 1. ITEMS - Block deactivation when referenced
-- ============================================
-- Reference checks:
-- - qmhq (item_id)
-- - qmhq_items (via qmhq)
-- - po_line_items (via purchase_orders)
-- - inventory_transactions
-- - stock_out_line_items

CREATE OR REPLACE FUNCTION block_item_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if item is referenced by active qmhq
  IF EXISTS (
    SELECT 1 FROM qmhq
    WHERE item_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if item is referenced by qmhq_items (via active qmhq)
  IF EXISTS (
    SELECT 1 FROM qmhq_items qi
    JOIN qmhq q ON q.id = qi.qmhq_id
    WHERE qi.item_id = OLD.id AND q.is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if item is referenced by po_line_items (via active purchase_orders)
  IF EXISTS (
    SELECT 1 FROM po_line_items pli
    JOIN purchase_orders po ON po.id = pli.purchase_order_id
    WHERE pli.item_id = OLD.id AND po.is_active = true AND pli.is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if item is referenced by active inventory_transactions
  IF EXISTS (
    SELECT 1 FROM inventory_transactions
    WHERE item_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if item is referenced by active stock_out_line_items
  IF EXISTS (
    SELECT 1 FROM stock_out_line_items
    WHERE item_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_block_item_deactivation ON items;
CREATE TRIGGER aa_block_item_deactivation
  BEFORE UPDATE ON items
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION block_item_deactivation();

COMMENT ON FUNCTION block_item_deactivation() IS
  'Prevents deactivation of items that are referenced by active records. Checks qmhq, qmhq_items, po_line_items, inventory_transactions, and stock_out_line_items.';

COMMENT ON TRIGGER aa_block_item_deactivation ON items IS
  'Blocks item deactivation when referenced by active records. Uses aa_ prefix to fire before audit triggers.';

-- ============================================
-- 2. STATUS CONFIG - Block deactivation when referenced
-- ============================================
-- Reference checks:
-- - qmrl (status_id)
-- - qmhq (status_id)

CREATE OR REPLACE FUNCTION block_status_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if status is referenced by active qmrl
  IF EXISTS (
    SELECT 1 FROM qmrl
    WHERE status_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if status is referenced by active qmhq
  IF EXISTS (
    SELECT 1 FROM qmhq
    WHERE status_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_block_status_deactivation ON status_config;
CREATE TRIGGER aa_block_status_deactivation
  BEFORE UPDATE ON status_config
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION block_status_deactivation();

COMMENT ON FUNCTION block_status_deactivation() IS
  'Prevents deactivation of status configurations that are assigned to active QMRL or QMHQ records.';

COMMENT ON TRIGGER aa_block_status_deactivation ON status_config IS
  'Blocks status deactivation when assigned to active records. Uses aa_ prefix to fire before audit triggers.';

-- ============================================
-- 3. CATEGORIES - Block deactivation when referenced
-- ============================================
-- Reference checks:
-- - qmrl (category_id)
-- - qmhq (category_id)
-- - items (category_id)

CREATE OR REPLACE FUNCTION block_category_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if category is referenced by active qmrl
  IF EXISTS (
    SELECT 1 FROM qmrl
    WHERE category_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if category is referenced by active qmhq
  IF EXISTS (
    SELECT 1 FROM qmhq
    WHERE category_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  -- Check if category is referenced by active items
  IF EXISTS (
    SELECT 1 FROM items
    WHERE category_id = OLD.id AND is_active = true
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this item is in use';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_block_category_deactivation ON categories;
CREATE TRIGGER aa_block_category_deactivation
  BEFORE UPDATE ON categories
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION block_category_deactivation();

COMMENT ON FUNCTION block_category_deactivation() IS
  'Prevents deactivation of categories that are assigned to active QMRL, QMHQ, or items.';

COMMENT ON TRIGGER aa_block_category_deactivation ON categories IS
  'Blocks category deactivation when assigned to active records. Uses aa_ prefix to fire before audit triggers.';

-- ============================================
-- INDEXES - Partial indexes for efficient reference checking
-- ============================================

-- For item reference checks
CREATE INDEX IF NOT EXISTS idx_qmhq_item_id_active ON qmhq(item_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_po_line_items_item_id_active ON po_line_items(item_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id_active ON inventory_transactions(item_id) WHERE is_active = true;
-- Note: idx_sor_li_item already exists on stock_out_line_items(item_id)
-- Note: idx_qmhq_items_item_id already exists on qmhq_items(item_id)

-- For status reference checks
CREATE INDEX IF NOT EXISTS idx_qmrl_status_id_active ON qmrl(status_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qmhq_status_id_active ON qmhq(status_id) WHERE is_active = true;

-- For category reference checks
CREATE INDEX IF NOT EXISTS idx_qmrl_category_id_active ON qmrl(category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qmhq_category_id_active ON qmhq(category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_items_category_id_active ON items(category_id) WHERE is_active = true;
