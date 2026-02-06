-- Migration: 049_item_sku_price_reference.sql
-- Purpose: Add price_reference column to items and implement new SKU generation system
--
-- Changes:
-- 1. Add price_reference column (TEXT, max 100 chars)
-- 2. Create get_category_abbreviation() function
-- 3. Create generate_random_suffix() function
-- 4. Drop old SKU trigger, create generate_item_sku_v2()
-- 5. Backfill existing items with new SKU format

-- ============================================
-- 1. Add price_reference column to items table
-- ============================================

ALTER TABLE items ADD COLUMN IF NOT EXISTS price_reference TEXT;

-- Add constraint for max length (100 characters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'items_price_reference_length'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_price_reference_length
      CHECK (char_length(price_reference) <= 100);
  END IF;
END $$;

-- Documentation
COMMENT ON COLUMN items.price_reference IS 'Price reference note for purchasing context (max 100 chars)';

-- ============================================
-- 2. Create get_category_abbreviation() function
-- ============================================

CREATE OR REPLACE FUNCTION get_category_abbreviation(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF category_name IS NULL OR category_name = '' THEN
    RETURN 'UNK';
  END IF;
  RETURN UPPER(
    array_to_string(
      ARRAY(
        SELECT substring(word, 1, 1)
        FROM regexp_split_to_table(category_name, '\s+') AS word
        WHERE word != ''
      ),
      ''
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_category_abbreviation(TEXT) IS 'Extract first letter of each word as uppercase abbreviation';

-- ============================================
-- 3. Create generate_random_suffix() function
-- ============================================

CREATE OR REPLACE FUNCTION generate_random_suffix(length INT DEFAULT 4)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION generate_random_suffix(INT) IS 'Generate random alphanumeric string (A-Z, 0-9)';

-- ============================================
-- 4. Drop old SKU trigger and create new generate_item_sku_v2()
-- ============================================

-- Drop old trigger and function if they exist
DROP TRIGGER IF EXISTS generate_item_sku_trigger ON items;
DROP FUNCTION IF EXISTS generate_item_sku();

CREATE OR REPLACE FUNCTION generate_item_sku_v2()
RETURNS TRIGGER AS $$
DECLARE
  cat_abbr TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT := 0;
  max_attempts INT := 10;
BEGIN
  -- Only generate/update SKU on INSERT or when category changes
  IF TG_OP = 'INSERT' OR
     (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN

    -- Get category abbreviation
    SELECT get_category_abbreviation(c.name) INTO cat_abbr
    FROM categories c WHERE c.id = NEW.category_id;

    cat_abbr := COALESCE(cat_abbr, 'UNK');

    -- For UPDATE: keep existing suffix, only update category portion
    IF TG_OP = 'UPDATE' AND OLD.sku IS NOT NULL THEN
      rand_suffix := substring(OLD.sku FROM '[A-Z0-9]{4}$');
      IF rand_suffix IS NOT NULL AND length(rand_suffix) = 4 THEN
        NEW.sku := 'SKU-' || cat_abbr || '-' || rand_suffix;
        RETURN NEW;
      END IF;
    END IF;

    -- For INSERT or UPDATE without valid suffix: generate new random
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_abbr || '-' || rand_suffix;

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

-- Create new trigger
CREATE TRIGGER generate_item_sku_v2_trigger
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION generate_item_sku_v2();

-- ============================================
-- 5. Backfill existing items with new SKU format
-- ============================================

DO $$
DECLARE
  item_rec RECORD;
  cat_abbr TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT;
  max_attempts INT := 10;
BEGIN
  FOR item_rec IN SELECT i.id, i.category_id, c.name as category_name
                  FROM items i
                  LEFT JOIN categories c ON c.id = i.category_id
                  WHERE i.is_active = true
  LOOP
    cat_abbr := COALESCE(
      get_category_abbreviation(item_rec.category_name),
      'UNK'
    );

    attempt := 0;
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_abbr || '-' || rand_suffix;

      IF NOT EXISTS (SELECT 1 FROM items WHERE sku = new_sku) THEN
        -- Disable trigger temporarily for this update to avoid re-generation
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        -- Fallback: append item ID snippet
        new_sku := 'SKU-' || cat_abbr || '-' || upper(substring(item_rec.id::text, 1, 4));
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
