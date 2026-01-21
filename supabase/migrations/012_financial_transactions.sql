-- Financial Transactions Table
-- Records Money In and Money Out transactions for QMHQ (expense and po routes)

-- Create transaction_type enum
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('money_in', 'money_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Financial transactions table
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent QMHQ reference
  qmhq_id UUID NOT NULL REFERENCES qmhq(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type transaction_type NOT NULL,

  -- Financial details
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN amount / exchange_rate ELSE 0 END
  ) STORED,

  -- Transaction details
  description TEXT,
  reference_no TEXT, -- External reference number
  transaction_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,

  -- Soft delete / void
  is_active BOOLEAN DEFAULT true,
  is_voided BOOLEAN DEFAULT false,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT,

  -- Timestamps and audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_financial_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_transaction_update_timestamp ON financial_transactions;
CREATE TRIGGER financial_transaction_update_timestamp
  BEFORE UPDATE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_transaction_updated_at();

-- Trigger to update QMHQ total_money_in when transaction is created/updated/deleted
CREATE OR REPLACE FUNCTION update_qmhq_money_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_qmhq_id UUID;
  new_total_money_in DECIMAL(15,2);
BEGIN
  -- Determine which QMHQ to update
  IF TG_OP = 'DELETE' THEN
    target_qmhq_id := OLD.qmhq_id;
  ELSE
    target_qmhq_id := NEW.qmhq_id;
  END IF;

  -- Calculate new total_money_in (only non-voided, active money_in transactions)
  SELECT COALESCE(SUM(amount_eusd), 0)
  INTO new_total_money_in
  FROM financial_transactions
  WHERE qmhq_id = target_qmhq_id
    AND transaction_type = 'money_in'
    AND is_active = true
    AND is_voided = false;

  -- Update QMHQ
  UPDATE qmhq
  SET total_money_in = new_total_money_in
  WHERE id = target_qmhq_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_transaction_update_qmhq_totals ON financial_transactions;
CREATE TRIGGER financial_transaction_update_qmhq_totals
  AFTER INSERT OR UPDATE OR DELETE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_qmhq_money_totals();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_qmhq_id ON financial_transactions(qmhq_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_is_active ON financial_transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_is_voided ON financial_transactions(is_voided);

-- Comments
COMMENT ON TABLE financial_transactions IS 'Money In/Out transactions for QMHQ expense and PO routes';
COMMENT ON COLUMN financial_transactions.transaction_type IS 'money_in: Funds received, money_out: Funds disbursed';
COMMENT ON COLUMN financial_transactions.amount_eusd IS 'Auto-calculated: amount / exchange_rate';
