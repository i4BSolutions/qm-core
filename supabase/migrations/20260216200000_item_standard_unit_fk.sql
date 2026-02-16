-- Migration: 20260216200000_item_standard_unit_fk
-- Description: Add standard_unit_id FK column to items table with backfill
-- Date: 2026-02-16

-- ========================================
-- Step 1: Add nullable column first
-- ========================================
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS standard_unit_id UUID;

-- ========================================
-- Step 2: Backfill all existing items with 'pcs' unit
-- ========================================
UPDATE public.items
SET standard_unit_id = (SELECT id FROM public.standard_units WHERE name = 'pcs' LIMIT 1)
WHERE standard_unit_id IS NULL;

-- ========================================
-- Step 3: Add NOT NULL constraint
-- ========================================
ALTER TABLE public.items
  ALTER COLUMN standard_unit_id SET NOT NULL;

-- ========================================
-- Step 4: Add FK constraint with ON DELETE RESTRICT
-- ========================================
ALTER TABLE public.items
  ADD CONSTRAINT items_standard_unit_id_fkey
  FOREIGN KEY (standard_unit_id)
  REFERENCES public.standard_units(id)
  ON DELETE RESTRICT;

-- ========================================
-- Step 5: Add index for FK lookups
-- ========================================
CREATE INDEX IF NOT EXISTS idx_items_standard_unit_id ON public.items(standard_unit_id);

-- ========================================
-- Step 6: Add comment
-- ========================================
COMMENT ON COLUMN public.items.standard_unit_id IS 'Standard unit of measurement for this item (e.g., pcs, kg, L)';
