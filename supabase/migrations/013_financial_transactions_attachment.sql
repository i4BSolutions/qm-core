-- Add attachment_url column to financial_transactions
-- For storing receipt/document images

ALTER TABLE financial_transactions
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

COMMENT ON COLUMN financial_transactions.attachment_url IS 'URL to attached receipt/document image in Supabase Storage';
