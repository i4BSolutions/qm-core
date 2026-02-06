-- Migration: 050_fix_category_abbreviation.sql
-- Purpose: Add unique 3-letter code to categories, use in SKU generation
-- Reason: Avoids Myanmar character complexity, consistent across languages

-- ============================================
-- 1. Add code column to categories table
-- ============================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS code CHAR(3);

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_code_unique'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_code_unique UNIQUE (code);
  END IF;
END $$;

-- Add check constraint for A-Z only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_code_format'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_code_format
      CHECK (code ~ '^[A-Z]{3}$');
  END IF;
END $$;

COMMENT ON COLUMN categories.code IS 'Unique 3-letter category code (A-Z) for SKU generation';

-- ============================================
-- 2. Function to generate unique category code
-- ============================================

CREATE OR REPLACE FUNCTION generate_category_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  new_code TEXT;
  attempt INT := 0;
  max_attempts INT := 100;
BEGIN
  LOOP
    -- Generate random 3-letter code
    new_code := substr(chars, floor(random() * 26 + 1)::INT, 1) ||
                substr(chars, floor(random() * 26 + 1)::INT, 1) ||
                substr(chars, floor(random() * 26 + 1)::INT, 1);

    -- Check if unique
    IF NOT EXISTS (SELECT 1 FROM categories WHERE code = new_code) THEN
      RETURN new_code;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique category code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Trigger to auto-generate code on category insert
-- ============================================

CREATE OR REPLACE FUNCTION set_category_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_category_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_category_code_trigger ON categories;
CREATE TRIGGER set_category_code_trigger
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION set_category_code();

-- ============================================
-- 4. Backfill existing categories with codes
-- ============================================

DO $$
DECLARE
  cat_rec RECORD;
BEGIN
  FOR cat_rec IN SELECT id FROM categories WHERE code IS NULL
  LOOP
    UPDATE categories SET code = generate_category_code() WHERE id = cat_rec.id;
  END LOOP;
END $$;

-- ============================================
-- 5. Update SKU generation to use category.code
-- ============================================

CREATE OR REPLACE FUNCTION generate_item_sku_v2()
RETURNS TRIGGER AS $$
DECLARE
  cat_code TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT := 0;
  max_attempts INT := 10;
BEGIN
  -- Only generate/update SKU on INSERT or when category changes
  IF TG_OP = 'INSERT' OR
     (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN

    -- Get category code (3-letter unique code)
    SELECT c.code INTO cat_code
    FROM categories c WHERE c.id = NEW.category_id;

    cat_code := COALESCE(cat_code, 'UNK');

    -- For UPDATE: keep existing suffix, only update category portion
    IF TG_OP = 'UPDATE' AND OLD.sku IS NOT NULL THEN
      rand_suffix := substring(OLD.sku FROM '[A-Z0-9]{4}$');
      IF rand_suffix IS NOT NULL AND length(rand_suffix) = 4 THEN
        NEW.sku := 'SKU-' || cat_code || '-' || rand_suffix;
        RETURN NEW;
      END IF;
    END IF;

    -- For INSERT or UPDATE without valid suffix: generate new random
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_code || '-' || rand_suffix;

      -- Check for collision
      IF NOT EXISTS (SELECT 1 FROM items WHERE sku = new_sku AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
        NEW.sku := new_sku;
        EXIT;
      END IF;

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique SKU after % attempts', max_attempts;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Regenerate all item SKUs with new category codes
-- ============================================

DO $$
DECLARE
  item_rec RECORD;
  cat_code TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT;
  max_attempts INT := 10;
BEGIN
  FOR item_rec IN SELECT i.id, i.category_id
                  FROM items i
                  WHERE i.is_active = true
  LOOP
    -- Get category code
    SELECT c.code INTO cat_code
    FROM categories c WHERE c.id = item_rec.category_id;

    cat_code := COALESCE(cat_code, 'UNK');

    attempt := 0;
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_code || '-' || rand_suffix;

      IF NOT EXISTS (SELECT 1 FROM items WHERE sku = new_sku) THEN
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        new_sku := 'SKU-' || cat_code || '-' || upper(substring(item_rec.id::text, 1, 4));
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
