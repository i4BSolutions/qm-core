-- Add auto-generated transaction_id to financial_transactions
-- Format: QMTRX-NNNN (e.g., QMTRX-0001, QMTRX-0002)

-- Add transaction_id column
ALTER TABLE financial_transactions
ADD COLUMN IF NOT EXISTS transaction_id TEXT UNIQUE;

-- Create sequence for transaction numbers
CREATE SEQUENCE IF NOT EXISTS financial_transaction_seq START 1;

-- Function to generate transaction ID
CREATE OR REPLACE FUNCTION generate_transaction_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get next sequence number
  next_num := nextval('financial_transaction_seq');

  -- Generate ID in format QMTRX-NNNN
  NEW.transaction_id := 'QMTRX-' || LPAD(next_num::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate transaction_id
DROP TRIGGER IF EXISTS generate_transaction_id_trigger ON financial_transactions;
CREATE TRIGGER generate_transaction_id_trigger
  BEFORE INSERT ON financial_transactions
  FOR EACH ROW
  WHEN (NEW.transaction_id IS NULL)
  EXECUTE FUNCTION generate_transaction_id();

-- Update existing records that don't have transaction_id
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT id FROM financial_transactions
    WHERE transaction_id IS NULL
    ORDER BY created_at ASC
  LOOP
    counter := counter + 1;
    UPDATE financial_transactions
    SET transaction_id = 'QMTRX-' || LPAD(counter::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;

  -- Reset sequence to next available number
  IF counter > 0 THEN
    PERFORM setval('financial_transaction_seq', counter);
  END IF;
END $$;

-- Add index for transaction_id
CREATE INDEX IF NOT EXISTS idx_financial_transactions_transaction_id
ON financial_transactions(transaction_id);

COMMENT ON COLUMN financial_transactions.transaction_id IS 'Auto-generated transaction ID in format QMTRX-NNNN';
