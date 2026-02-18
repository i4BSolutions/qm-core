-- Migration: 20260218200000_stock_out_approvals_notes.sql
-- Description: Add notes column to stock_out_approvals.
--              The L1ApprovalDialog includes an optional Notes field and conditionally
--              inserts { notes: value } into the payload. Without this column the insert
--              fails with "column does not exist" whenever a note is provided, causing
--              L1 approvals to fail silently when a note is entered.
-- Dependencies: 052_stock_out_requests.sql
-- Phase: debug-sor-l1-approve-note-fails

ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN stock_out_approvals.notes IS
  'Optional free-text note recorded by the approver at the time of L1 (quantity) or L2 (warehouse assignment) approval.';
