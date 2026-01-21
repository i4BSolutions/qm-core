-- Migration: Add 'item' to entity_type enum and update items table
-- This allows items to use the categories table like QMRL and QMHQ

-- =============================================================================
-- 1. ADD 'item' TO entity_type ENUM
-- =============================================================================

-- Add 'item' to the entity_type enum
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'item';

-- =============================================================================
-- 2. ADD category_id TO items TABLE
-- =============================================================================

-- Add category_id column (foreign key to categories table)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

-- Create index for category_id
CREATE INDEX IF NOT EXISTS idx_items_category_id ON public.items(category_id);

-- =============================================================================
-- 3. COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.items.category_id IS 'Reference to categories table for item classification';
