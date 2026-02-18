-- Fix: stock_out_approvals.conversion_rate has NOT NULL but no DEFAULT
-- L1 approval inserts don't provide conversion_rate, causing constraint violation
ALTER TABLE stock_out_approvals ALTER COLUMN conversion_rate SET DEFAULT 1.0000;

NOTIFY pgrst, 'reload schema';
