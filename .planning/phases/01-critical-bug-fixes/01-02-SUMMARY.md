---
phase: 01-critical-bug-fixes
plan: 02
subsystem: inventory
tags: [supabase, inventory-transactions, wac, stock-in, audit-trigger]

# Dependency graph
requires:
  - phase: 01-critical-bug-fixes
    provides: Investigation methodology for critical bugs
provides:
  - Working stock-in functionality for both invoice and manual modes
  - Proper currency and exchange_rate defaults for WAC calculation
  - Fixed audit trigger handling for tables without created_by column
affects: [02-file-attachments, 03-po-approvals, 04-inventory-visibility]

# Tech tracking
tech-stack:
  added: []
  patterns: [audit-trigger-jsonb-safe-access, default-currency-exchange-handling]

key-files:
  created: []
  modified:
    - app/(dashboard)/inventory/stock-in/page.tsx
    - supabase/migrations/028_fix_audit_trigger_created_by.sql
    - supabase/migrations/029_fix_audit_trigger_v2.sql

key-decisions:
  - "Default manual stock-in to MMK currency with exchange rate 1.0"
  - "Use JSONB ? operator for safe column existence checks in audit trigger"

patterns-established:
  - "Pattern 1: Manual stock-in requires currency and exchange_rate for WAC trigger"
  - "Pattern 2: Audit triggers must handle schema variations using to_jsonb() and ? operator"

# Metrics
duration: 45min
completed: 2026-01-27
---

# Phase 01 Plan 02: Stock-In Fix Summary

**Fixed stock-in for manual mode by adding currency/exchange_rate defaults, and resolved audit trigger failures for tables without created_by column**

## Performance

- **Duration:** 45 min (estimated from execution)
- **Started:** 2026-01-27T10:00:00Z (estimated)
- **Completed:** 2026-01-27T10:45:56Z
- **Tasks:** 3 (investigation, fix, verification)
- **Files modified:** 3

## Accomplishments
- Manual stock-in now successfully creates inventory transactions with proper WAC calculation
- Invoice stock-in continues to work correctly (was already functional)
- Audit trigger fixed to handle tables with varying schemas (po_line_items, invoice_line_items without created_by)
- All 6 success criteria verified through human testing

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Investigate and fix stock-in** - `1716d36` (fix)
   - Root cause identified: Manual mode missing currency and exchange_rate fields
   - Fixed by adding default values: currency='MMK', exchange_rate=1.0
   - Comment added explaining why these defaults are required for WAC calculation

2. **Task 3: Human verification** - APPROVED (checkpoint passed)

**Additional fixes by orchestrator:**
- `fb63cf2` - Audit trigger handles tables without created_by (first attempt)
- `d463405` - Audit trigger uses JSONB for safe column access (final solution)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/(dashboard)/inventory/stock-in/page.tsx` - Added currency='MMK' and exchange_rate=1 defaults for manual mode
- `supabase/migrations/028_fix_audit_trigger_created_by.sql` - First fix attempt for audit trigger
- `supabase/migrations/029_fix_audit_trigger_v2.sql` - Final audit trigger fix using JSONB ? operator

## Decisions Made

**1. Default currency and exchange rate for manual stock-in**
- **Decision:** Manual mode defaults to currency='MMK' and exchange_rate=1.0
- **Rationale:** WAC calculation trigger requires these fields. MMK is the primary currency, and rate=1.0 means no conversion (local currency input)
- **Impact:** Users don't need to specify currency for manual entries, simplifying the form

**2. Safe column access in audit triggers**
- **Decision:** Use to_jsonb() with ? operator to check column existence before accessing
- **Rationale:** Tables have different schemas (some have created_by, some don't; some have status_id, some don't)
- **Impact:** Audit trigger works reliably across all tables without schema-specific logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Audit trigger failure on tables without created_by**
- **Found during:** Task 3 verification (human testing revealed audit trigger errors)
- **Issue:** Audit trigger tried to access NEW.created_by on po_line_items and invoice_line_items which don't have this column
- **Fix:** Rewrote trigger to use to_jsonb(NEW) ? 'created_by' to safely check if column exists before accessing. Falls back to auth.uid() for changed_by field.
- **Files modified:** supabase/migrations/028_fix_audit_trigger_created_by.sql, supabase/migrations/029_fix_audit_trigger_v2.sql
- **Verification:** Stock-in completed successfully in both modes without trigger errors
- **Committed in:** fb63cf2, d463405 (by orchestrator during verification)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Audit trigger fix was necessary to unblock verification. The core stock-in fix (1716d36) was exactly as planned. No scope creep.

## Issues Encountered

**Root cause investigation:**
- Initial investigation revealed missing currency and exchange_rate fields in manual mode
- The WAC calculation trigger (update_item_wac) requires these fields to calculate weighted average cost
- Invoice mode already had these fields, so it was working correctly
- Fix was straightforward: add the two missing fields with sensible defaults

**Unexpected audit trigger issue:**
- During verification testing, discovered audit trigger was failing on certain tables
- This was unrelated to the stock-in bug but blocked successful transaction creation
- Required JSONB-based safe column access pattern to handle schema variations

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready:**
- Stock-in functionality fully operational for both modes
- Inventory transactions creating correctly with proper WAC calculation
- Audit trail working reliably across all table schemas

**Verified Success Criteria:**
1. ✅ User can complete stock-in from invoice without system errors
2. ✅ User can complete manual stock-in without system errors
3. ✅ Inventory transactions are created with correct data
4. ✅ Invoice line item received_quantity is updated (invoice mode)
5. ✅ Item WAC is recalculated after stock-in
6. ✅ Warehouse stock is visible in warehouse detail page

**Ready for:** Phase 1 Plan 3 (User management fixes), Phase 2 (File attachments)

---
*Phase: 01-critical-bug-fixes*
*Completed: 2026-01-27*
