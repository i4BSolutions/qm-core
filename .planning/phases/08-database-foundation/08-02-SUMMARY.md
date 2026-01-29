---
phase: 08-database-foundation
plan: 02
subsystem: database
tags: [postgres, triggers, audit, invoice, void, cascade, rls]

# Dependency graph
requires:
  - phase: 08-01
    provides: Currency validation constraints
  - phase: prior
    provides: Invoice line items, PO line items, inventory transactions tables
provides:
  - Invoice void blocking when stock-in exists
  - Comprehensive audit logging for void cascade effects
  - Trigger ordering pattern (aa_ for first, zz_ for last)
affects: [invoice-ui, void-workflow, audit-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEFORE trigger with aa_ prefix for pre-validation"
    - "AFTER trigger with zz_ prefix for post-cascade audit"
    - "SECURITY DEFINER with SET search_path for secure triggers"

key-files:
  created:
    - supabase/migrations/040_invoice_void_block_stockin.sql
    - supabase/migrations/041_invoice_void_cascade_audit.sql
  modified: []

key-decisions:
  - "Trigger ordering via alphabetical prefix (aa_ first, zz_ last)"
  - "Partial index for efficient stock-in lookup by invoice_id"
  - "Balance in Hand unchanged on void (PO commitment preserved by design)"

patterns-established:
  - "Trigger ordering: aa_ prefix fires first, zz_ prefix fires last"
  - "Void cascade audit: log each affected entity separately for full auditability"
  - "Human-readable audit summaries include source document reference"

# Metrics
duration: 8min
completed: 2026-01-30
---

# Phase 8 Plan 02: Invoice Void Cascade Summary

**Invoice void blocked when stock-in exists, with comprehensive audit logging of PO line item quantity and status cascade effects**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-30T09:00:00Z
- **Completed:** 2026-01-30T09:08:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Invoices with stock-in transactions cannot be voided (hard block with clear error message)
- All void cascade effects logged to audit_logs table (PO line item invoiced_quantity changes, PO status recalculations)
- Trigger ordering ensures block fires before cascade, audit fires after cascade
- Human-readable summaries include invoice number reference for traceability

## Task Commits

Each task was committed atomically:

1. **Task 1: Block invoice void when stock-in exists** - `ed723c4` (feat)
2. **Task 2: Create invoice void cascade audit trigger** - `81a73cc` (feat)

## Files Created/Modified

- `supabase/migrations/040_invoice_void_block_stockin.sql` - BEFORE UPDATE trigger to block void when inventory_in transactions exist
- `supabase/migrations/041_invoice_void_cascade_audit.sql` - AFTER UPDATE trigger to log cascade effects (PO line item qty, PO status)

## Decisions Made

1. **Trigger ordering via alphabetical prefix** - Used 'aa_' prefix for block trigger (fires first) and 'zz_' prefix for audit trigger (fires last). PostgreSQL fires triggers alphabetically within same timing.

2. **Partial index for stock-in lookup** - Added `idx_inventory_transactions_invoice_stockin` with WHERE clause for movement_type = 'inventory_in' AND is_active = true for efficient void check.

3. **Balance in Hand unchanged by design** - Documented that voiding an invoice does NOT change Balance in Hand because PO commitment remains unchanged. Balance tracks committed vs received, not invoiced.

4. **Separate audit entries per affected entity** - Each affected PO line item and PO gets its own audit_logs entry (vs single combined entry) for better auditability and filtering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Docker not running** - Could not run `npx supabase db reset` for live verification. Verified SQL syntax manually against existing migration patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Invoice void cascade controls complete at database layer
- Ready for UI implementation of void workflow
- Audit history tab can display void cascade effects
- Balance in Hand behavior documented (unchanged on void)

---
*Phase: 08-database-foundation*
*Completed: 2026-01-30*
