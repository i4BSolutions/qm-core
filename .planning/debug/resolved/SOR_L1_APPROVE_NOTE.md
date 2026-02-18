---
status: resolved
trigger: "SOR L1 approval with note fails silently — clicking Approve with a note does nothing; without note it works"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:02:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: RESOLVED — notes column was missing from stock_out_approvals table. Fix: added migration and updated TypeScript types.
test: TypeScript type-check passes with no errors.
expecting: L1 approvals with notes now succeed.
next_action: Archive

## Symptoms

expected: L1 approval should succeed whether or not a note is included. The approval should be recorded in stock_out_approvals with the note text.
actual: When a note is entered in the L1 approval dialog, clicking approve does nothing — no error message, no success, the dialog may stay open or close without effect. Without a note, the approval works.
errors: No visible error messages — it fails silently. Actual DB error: "column notes does not exist", caught by try/catch, but toast may appear with cryptic message.
reproduction: Open a SOR detail page, click L1 Approve on a line item, type a note in the notes field, click Approve. Nothing happens.
timeline: The L1 approval system was built in v1.12 phase 57.

## Eliminated

- hypothesis: Try/catch silently swallowing with no toast
  evidence: toast.error IS called — but the actual root cause is a missing DB column, not the error handling
  timestamp: 2026-02-18T00:01:00Z

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: l1-approval-dialog.tsx handleSubmit (line 94-100)
  found: Insert payload uses `...(notes.trim() ? { notes: notes.trim() } : {})`. When notes non-empty, inserts `notes` column.
  implication: If stock_out_approvals lacks a `notes` column, the insert fails with PostgreSQL error.

- timestamp: 2026-02-18T00:01:00Z
  checked: All migrations touching stock_out_approvals (052, 053, 054, 20260217100000, 20260218100000)
  found: Columns present: id, line_item_id, approval_number, approved_quantity, decision, rejection_reason, decided_by, decided_at, is_active, created_by, updated_by, created_at, updated_at, layer, parent_approval_id, warehouse_id, conversion_rate. NO `notes` column.
  implication: Root cause confirmed — the `notes` column was never added despite the dialog UI providing a notes field.

- timestamp: 2026-02-18T00:02:00Z
  checked: TypeScript types in types/database.ts for stock_out_approvals
  found: `notes` column also absent from Row/Insert/Update type definitions (and `conversion_rate` was also missing from types).
  implication: Both the migration and the types needed updating.

## Resolution

root_cause: The `notes` column does not exist on the `stock_out_approvals` table. The L1ApprovalDialog includes a Notes text area and conditionally adds `notes: notes.trim()` to the Supabase insert payload when the user enters any text. This causes the insert to fail with a PostgreSQL "column does not exist" error, making the approval silently fail whenever a note is provided.
fix: |
  1. Created migration supabase/migrations/20260218200000_stock_out_approvals_notes.sql
     — ALTER TABLE stock_out_approvals ADD COLUMN IF NOT EXISTS notes TEXT
  2. Updated types/database.ts stock_out_approvals Row/Insert/Update types to include
     notes: string | null and conversion_rate: number | null (conversion_rate was also missing from types)
verification: npm run type-check passes with no errors. No code changes needed in the dialog — the insert payload was already correct.
files_changed:
  - supabase/migrations/20260218200000_stock_out_approvals_notes.sql (new)
  - types/database.ts (updated stock_out_approvals Row/Insert/Update)
