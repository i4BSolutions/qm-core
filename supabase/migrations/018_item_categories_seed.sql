-- Migration: Seed default item categories
-- Separate migration because enum values can't be used in the same transaction they're added

-- =============================================================================
-- SEED DEFAULT ITEM CATEGORIES
-- =============================================================================

INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('item', 'Equipment', 'Tools, machinery, and equipment', '#3B82F6', 1),
  ('item', 'Consumable', 'Items that are used up', '#10B981', 2),
  ('item', 'Uniform', 'Clothing and uniforms', '#8B5CF6', 3),
  ('item', 'Office Supplies', 'Stationery and office items', '#F59E0B', 4),
  ('item', 'Electronics', 'Electronic devices and components', '#EC4899', 5),
  ('item', 'Other', 'Miscellaneous items', '#6B7280', 6)
ON CONFLICT (entity_type, name) DO NOTHING;
