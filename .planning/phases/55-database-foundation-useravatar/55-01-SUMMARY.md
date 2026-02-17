---
phase: 55-database-foundation-useravatar
plan: 01
subsystem: database
tags: [postgres, enum-extension, trigger-rewrite, stock-out-approval, two-layer-approval, migration, backfill]

# Dependency graph
requires:
  - phase: 34-database-trigger-hardening
    provides: advisory lock pattern (pg_advisory_xact_lock) used in validate_sor_approval L2 stock check
  - phase: 27-stock-out-approval-db-foundation
    provides: stock_out_approvals table, sor_line_item_status enum, original trigger functions
provides:
  - migration 063 (20260217100000_two_layer_approval_schema.sql) with two-layer approval schema
  - layer/parent_approval_id/warehouse_id columns on stock_out_approvals
  - awaiting_admin and fully_approved enum values in sor_line_item_status
  - 6 rewritten trigger functions enforcing two-layer flow
  - backfill: existing approved approvals get layer=admin, approved line items get status=fully_approved
  - updated TypeScript types matching new schema
affects:
  - 55-02 (UserAvatar component — independent workstream, same phase)
  - 56-list-views (uses stock_out_approvals.layer for approval UI display)
  - 57-l2-approval-ui (uses warehouse_id column and awaiting_admin status)
  - 58-approval-workflow-ui (uses fully_approved execution flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALTER TYPE ... ADD VALUE IF NOT EXISTS outside BEGIN block (enum extension without transaction)"
    - "pg_advisory_xact_lock on item_id+warehouse_id hash for L2 concurrent approval serialization"
    - "BEFORE INSERT trigger auto-sets NEW.layer from parent_approval_id presence"
    - "Six-step migration: enum extension -> schema -> transition guard rewrite -> trigger rewrites -> backfill -> comments"

key-files:
  created:
    - supabase/migrations/20260217100000_two_layer_approval_schema.sql
  modified:
    - types/database.ts
    - components/stock-out-requests/line-item-table.tsx

key-decisions:
  - "Layer auto-assignment in trigger: parent_approval_id IS NULL = quartermaster, IS NOT NULL = admin — callers do not set layer directly"
  - "validate_sor_line_item_status_transition rewritten first (before backfill) to allow approved->fully_approved transition for backfill"
  - "L2 approval has no reject option: validate_sor_approval enforces decision must be 'approved' for admin layer"
  - "warehouse_id column added to stock_out_approvals in this migration (not deferred to phase 57) — required for L2 trigger stock cap validation"
  - "Rejected approvals backfilled with layer=quartermaster (Claude's discretion per plan)"
  - "validate_sor_fulfillment requires layer=admin AND decision=approved — L1 approvals cannot be directly executed"

patterns-established:
  - "Two-layer approval flow: pending -> awaiting_admin (L1 qty approve) -> fully_approved (L2 warehouse assign) -> execution"
  - "Trigger order: validate_sor_approval (BEFORE) sets layer, update_line_item_status_on_approval (AFTER) reads layer"

requirements-completed: [APPR-06]

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 55 Plan 01: Two-Layer Approval Schema Summary

**PostgreSQL migration 063 adding layer/parent_approval_id/warehouse_id to stock_out_approvals, awaiting_admin/fully_approved enum values, 6 rewritten trigger functions, and data backfill for backward-compatible two-layer approval flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T09:55:07Z
- **Completed:** 2026-02-17T09:59:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created migration 063 with atomic two-layer approval schema: enum extension outside transaction, 3 new columns on stock_out_approvals, 6 rewritten trigger functions, data backfill for existing records
- Updated TypeScript types to expose layer, parent_approval_id, warehouse_id on stock_out_approvals and the two new sor_line_item_status enum values
- Established the database foundation that phases 56, 57, and 58 all depend on

## Task Commits

Each task was committed atomically:

1. **Task 1: Create two-layer approval database migration** - `048aa19` (feat)
2. **Task 2: Update TypeScript types for two-layer approval schema** - `a12fa9d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/20260217100000_two_layer_approval_schema.sql` - Migration 063: enum extension, schema columns, 6 trigger rewrites, backfill
- `types/database.ts` - Added layer/parent_approval_id/warehouse_id to stock_out_approvals types; added awaiting_admin/fully_approved to sor_line_item_status enum
- `components/stock-out-requests/line-item-table.tsx` - Added STATUS_CONFIG entries for awaiting_admin and fully_approved (auto-fix)

## Decisions Made
- Layer auto-assignment in BEFORE INSERT trigger: if `parent_approval_id IS NULL` then layer='quartermaster', else layer='admin'. Callers insert without setting layer explicitly.
- `validate_sor_line_item_status_transition` is rewritten FIRST in the transaction (before backfill) because the old guard blocks `approved -> fully_approved` which the backfill needs.
- `warehouse_id` added to `stock_out_approvals` now (not deferred to Phase 57 UI) because L2 trigger stock cap validation requires it at migration time.
- Rejected approvals backfilled with `layer='quartermaster'` (they represent L1 rejection decisions).
- `validate_sor_fulfillment` now checks `layer='admin' AND decision='approved'` — prevents L1-only approvals from being executed directly.
- L2 approval has no reject option: only decision='approved' allowed for admin layer (enforced in `validate_sor_approval`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added awaiting_admin and fully_approved to STATUS_CONFIG in line-item-table.tsx**
- **Found during:** Task 2 (TypeScript type update)
- **Issue:** Adding two new values to sor_line_item_status enum caused TypeScript error TS2739 in `components/stock-out-requests/line-item-table.tsx` — the `STATUS_CONFIG` Record was missing entries for the new enum values
- **Fix:** Added `awaiting_admin` (blue color theme) and `fully_approved` (emerald color theme, same as approved) to the STATUS_CONFIG record
- **Files modified:** `components/stock-out-requests/line-item-table.tsx`
- **Verification:** `npm run type-check` passes with zero errors
- **Committed in:** `a12fa9d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — exhaustive Record type fix)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered
- Supabase local container not running — could not run `npx supabase db reset`. Migration verified by manual SQL structure review: enum extension outside transaction block, all 6 trigger functions rewritten with CREATE OR REPLACE, backfill runs after trigger rewrites, COMMIT at end.

## User Setup Required
None — no external service configuration required. The migration will apply on the next `npx supabase db reset` or `npx supabase db push` against the target environment.

## Next Phase Readiness
- Migration 063 provides all database structures needed by phases 56-58
- `layer` column: phases 56-57 approval UI will read and set this
- `warehouse_id` column: phase 57 L2 approval form will populate this
- `awaiting_admin` / `fully_approved` statuses: phase 56 list views will display these
- Phase 55-02 (UserAvatar component) is independent and can proceed immediately

## Self-Check: PASSED

- FOUND: supabase/migrations/20260217100000_two_layer_approval_schema.sql
- FOUND: types/database.ts
- FOUND: components/stock-out-requests/line-item-table.tsx
- FOUND: .planning/phases/55-database-foundation-useravatar/55-01-SUMMARY.md
- FOUND: commit 048aa19 (feat: migration 063)
- FOUND: commit a12fa9d (feat: TypeScript types)

---
*Phase: 55-database-foundation-useravatar*
*Completed: 2026-02-17*
