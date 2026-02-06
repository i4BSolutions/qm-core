-- Migration: 050_fix_category_abbreviation.sql
-- Purpose: Fix category abbreviation to always return exactly 3 characters
-- Handles: Single words, Myanmar text, multi-word categories

CREATE OR REPLACE FUNCTION get_category_abbreviation(category_name TEXT)
RETURNS TEXT AS $$
DECLARE
  abbr TEXT;
  words TEXT[];
  word_count INT;
BEGIN
  -- Handle null/empty
  IF category_name IS NULL OR category_name = '' THEN
    RETURN 'UNK';
  END IF;

  -- Split by whitespace
  words := regexp_split_to_array(trim(category_name), '\s+');
  word_count := array_length(words, 1);

  IF word_count IS NULL OR word_count = 0 THEN
    RETURN 'UNK';
  END IF;

  -- Strategy based on word count:
  -- 1 word: take first 3 characters
  -- 2 words: take 2 from first, 1 from second (or 1+2 if first is short)
  -- 3+ words: take first letter of first 3 words

  IF word_count = 1 THEN
    -- Single word: take first 3 characters
    abbr := UPPER(substring(words[1], 1, 3));
  ELSIF word_count = 2 THEN
    -- Two words: take 2 from first, 1 from second
    abbr := UPPER(substring(words[1], 1, 2) || substring(words[2], 1, 1));
  ELSE
    -- 3+ words: first letter of first 3 words
    abbr := UPPER(substring(words[1], 1, 1) || substring(words[2], 1, 1) || substring(words[3], 1, 1));
  END IF;

  -- Ensure exactly 3 characters (pad with X if needed)
  IF length(abbr) < 3 THEN
    abbr := rpad(abbr, 3, 'X');
  END IF;

  RETURN abbr;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_category_abbreviation(TEXT) IS 'Generate exactly 3-character category abbreviation for SKU';
