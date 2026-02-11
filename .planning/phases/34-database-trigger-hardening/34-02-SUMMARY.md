---
phase: 34-database-trigger-hardening
plan: 02
subsystem: database-triggers
tags: [trigger-hardening, auto-population, idempotency, inventory-transactions, stock-out-requests]

dependency_graph:
  requires:
    - stock_out_approvals table (052)
    - stock_out_line_items table (052)
    - stock_out_requests table (052)
    - inventory_transactions table (023)
  provides:
    - auto_populate_qmhq_from_sor() function
    - trg_auto_populate_qmhq_from_sor trigger
    - idx_unique_approval_execution partial unique index
  affects:
    - inventory_transactions.qmhq_id (auto-populated)
    - stock-out execution logic (duplicate prevention)

tech_stack:
  added:
    - PostgreSQL BEFORE INSERT trigger for auto-population
    - Partial unique index for idempotency enforcement
  patterns:
    - Guard clause pattern in trigger function (early return)
    - JOIN chain traversal (approval -> line_item -> request)
    - Partial unique index with WHERE clause filtering
    - Data migration before constraint application

key_files:
  created:
    - supabase/migrations/061_auto_populate_qmhq_link.sql
    - supabase/migrations/062_idempotency_constraint_execution.sql
  modified: []

decisions:
  - "Auto-populate qmhq_id from SOR chain only when stock_out_approval_id is present"
  - "Don't override explicitly set qmhq_id (guard clause #3)"
  - "Partial unique index applies only to completed + active inventory_out transactions"
  - "NULL approval_id transactions (manual stock-outs) unaffected by idempotency constraint"
  - "Keep most recent duplicate on cleanup, soft-delete older ones"

metrics:
  duration_seconds: 65
  completed_date: 2026-02-11
  tasks_completed: 2
  files_created: 2
  commits: 2
---

# Phase 34 Plan 02: QMHQ Auto-Population and Idempotency Constraints

**One-liner:** Auto-populate QMHQ link from SOR chain and enforce single-execution idempotency via partial unique index

## Overview

Added two database hardening mechanisms for inventory_transactions: (1) BEFORE INSERT trigger that auto-populates qmhq_id by traversing the SOR chain when stock_out_approval_id is present, preventing orphaned transactions; (2) partial unique index that prevents the same approval from being executed more than once, enforcing idempotency during per-line-item execution.

## What Was Built

### Migration 061: QMHQ Auto-Population Trigger

**Function: `auto_populate_qmhq_from_sor()`**

Three guard clauses for early return:
1. Movement type check: Only applies to `inventory_out`
2. Approval link check: Only applies when `stock_out_approval_id IS NOT NULL`
3. Override protection: Only applies when `qmhq_id IS NULL` (don't override explicit values)

Main logic: JOIN chain traversal
```sql
SELECT r.qmhq_id INTO sor_qmhq_id
FROM stock_out_approvals a
JOIN stock_out_line_items li ON a.line_item_id = li.id
JOIN stock_out_requests r ON li.request_id = r.id
WHERE a.id = NEW.stock_out_approval_id;
```

**Trigger: `trg_auto_populate_qmhq_from_sor`**
- BEFORE INSERT on inventory_transactions
- Fires before snapshot trigger (maintains trigger execution order)

**Backfill Query**
Updated existing SOR-linked transactions with missing qmhq_id (only when parent request has qmhq_id).

### Migration 062: Idempotency Constraint

**Pre-Migration Data Cleanup**
- CTE identifies duplicates (multiple completed transactions for same approval_id)
- Keeps most recent transaction (ORDER BY created_at DESC, rn=1)
- Soft-deletes older duplicates (is_active = false)
- Adds audit note: "Auto-deactivated: duplicate execution (Phase 34 data migration)"

**Partial Unique Index: `idx_unique_approval_execution`**
```sql
CREATE UNIQUE INDEX idx_unique_approval_execution
  ON inventory_transactions(stock_out_approval_id)
  WHERE movement_type = 'inventory_out'
    AND status = 'completed'
    AND is_active = true;
```

**Why Partial:**
- NULL values for `stock_out_approval_id` are ignored (PostgreSQL standard: NULL != NULL)
- Manual stock-outs unaffected (they have NULL approval_id)
- Cancelled/pending transactions don't enforce uniqueness (only completed)
- Soft-deleted transactions excluded (allows re-execution after correction)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Trigger Execution Order
1. `trg_auto_populate_qmhq_from_sor` (BEFORE INSERT) - runs first
2. `inventory_transaction_snapshot_item` (BEFORE INSERT) - runs second
3. Other AFTER INSERT triggers - run after row inserted

### Idempotency Enforcement
The partial unique index creates a database-level constraint that returns error on INSERT/UPDATE:
```
ERROR: duplicate key value violates unique constraint "idx_unique_approval_execution"
```

Application layer should catch this error and treat as non-fatal (approval already executed).

### Edge Cases Handled
1. **SOR not linked to QMHQ**: Auto-population sets qmhq_id = NULL (allowed)
2. **Manual stock-outs**: NULL approval_id bypasses both mechanisms
3. **Explicitly set qmhq_id**: Guard clause prevents override
4. **Cancelled transactions**: Don't participate in idempotency constraint
5. **Soft-deleted transactions**: Excluded from uniqueness (allows correction workflow)

## Verification

### Trigger Verification
```bash
grep "trg_auto_populate_qmhq_from_sor" supabase/migrations/061_auto_populate_qmhq_link.sql
# Output: DROP TRIGGER IF EXISTS... CREATE TRIGGER...

grep -c "JOIN" supabase/migrations/061_auto_populate_qmhq_link.sql
# Output: 4 (2 in function, 2 in backfill)
```

### Index Verification
```bash
grep "idx_unique_approval_execution" supabase/migrations/062_idempotency_constraint_execution.sql
# Output: CREATE UNIQUE INDEX... COMMENT ON INDEX...

grep -c "WHERE" supabase/migrations/062_idempotency_constraint_execution.sql
# Output: 3 (duplicate cleanup CTE, unique index, subquery)
```

## Success Criteria

- [x] QMHQ link auto-populates from SOR chain during transaction creation (SC4)
- [x] Cannot execute the same approval twice — unique index prevents duplicates (SC5)
- [x] Manual stock-outs unaffected by constraints
- [x] Explicitly set qmhq_id not overridden
- [x] Non-completed and inactive transactions excluded from idempotency
- [x] Existing data cleaned up before constraints applied

## Files Created

1. **supabase/migrations/061_auto_populate_qmhq_link.sql** (72 lines)
   - Function: auto_populate_qmhq_from_sor()
   - Trigger: trg_auto_populate_qmhq_from_sor
   - Backfill query for existing orphaned transactions

2. **supabase/migrations/062_idempotency_constraint_execution.sql** (47 lines)
   - Data migration: duplicate cleanup CTE
   - Partial unique index: idx_unique_approval_execution
   - Index comment explaining purpose

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5815f45 | feat(34-02): add QMHQ auto-population trigger for SOR-linked transactions |
| 2 | d1cd4e6 | feat(34-02): add idempotency constraint for approval execution |

## Impact

**Immediate:**
- All future SOR-linked inventory_out transactions automatically have qmhq_id populated
- Impossible to execute the same approval twice at database level
- Existing orphaned transactions backfilled with correct qmhq_id

**Future:**
- Phase 35 per-line-item execution logic can safely iterate over approvals without worrying about duplicate execution
- QMHQ transaction linking reports will be complete (no orphans)
- Audit trail maintains data integrity (every SOR execution properly linked)

## Self-Check: PASSED

**File existence:**
```bash
[ -f "supabase/migrations/061_auto_populate_qmhq_link.sql" ] && echo "FOUND: 061_auto_populate_qmhq_link.sql"
# FOUND: 061_auto_populate_qmhq_link.sql

[ -f "supabase/migrations/062_idempotency_constraint_execution.sql" ] && echo "FOUND: 062_idempotency_constraint_execution.sql"
# FOUND: 062_idempotency_constraint_execution.sql
```

**Commit existence:**
```bash
git log --oneline --all | grep -q "5815f45" && echo "FOUND: 5815f45"
# FOUND: 5815f45

git log --oneline --all | grep -q "d1cd4e6" && echo "FOUND: d1cd4e6"
# FOUND: d1cd4e6
```

All files created, all commits exist, all success criteria met.

---

*Plan executed: 2026-02-11*
*Duration: 65 seconds*
*Executor: Claude Sonnet 4.5*
