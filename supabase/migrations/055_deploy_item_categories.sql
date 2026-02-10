-- Migration: Deploy Item Categories (Migrations 017 + 018 Combined)
-- This ensures entity_type enum includes 'item' and seeds default item categories
-- Run this migration if item categories are missing from the categories table

-- =============================================================================
-- PART 1: Add 'item' to entity_type enum (from 017_item_categories.sql)
-- =============================================================================

-- Add 'item' value to entity_type enum if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'item' AND enumtypid = 'public.entity_type'::regtype) THEN
        ALTER TYPE public.entity_type ADD VALUE 'item';
    END IF;
END $$;

-- Add category_id to items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'items'
        AND column_name = 'category_id'
    ) THEN
        ALTER TABLE public.items
        ADD COLUMN category_id UUID REFERENCES public.categories(id);

        CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category_id);

        COMMENT ON COLUMN public.items.category_id IS 'Reference to categories table for item classification';
    END IF;
END $$;

-- =============================================================================
-- PART 2: Seed Default Item Categories (from 018_item_categories_seed.sql)
-- =============================================================================

INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('item', 'Equipment', 'Tools, machinery, and equipment', '#3B82F6', 1),
  ('item', 'Consumable', 'Items that are used up', '#10B981', 2),
  ('item', 'Uniform', 'Clothing and uniforms', '#8B5CF6', 3),
  ('item', 'Office Supplies', 'Stationery and office items', '#F59E0B', 4),
  ('item', 'Electronics', 'Electronic devices and components', '#EC4899', 5),
  ('item', 'Other', 'Miscellaneous items', '#6B7280', 6)
ON CONFLICT (entity_type, name) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify item categories were created
DO $$
DECLARE
    item_category_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO item_category_count
    FROM public.categories
    WHERE entity_type = 'item' AND is_active = true;

    RAISE NOTICE 'Item categories created: %', item_category_count;

    IF item_category_count < 6 THEN
        RAISE WARNING 'Expected 6 item categories but found %', item_category_count;
    END IF;
END $$;
