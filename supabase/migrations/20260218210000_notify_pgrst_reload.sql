-- Notify PostgREST to reload schema cache after adding notes column
-- This ensures the new stock_out_approvals.notes column is recognized by the API
NOTIFY pgrst, 'reload schema';
