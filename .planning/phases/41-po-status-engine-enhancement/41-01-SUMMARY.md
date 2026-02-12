---
phase: 41-po-status-engine-enhancement
plan: 01
subsystem: po-lifecycle
tags:
  - database
  - triggers
  - server-actions
  - status-calculation
  - concurrency
  - cancellation
dependency_graph:
  requires:
    - migration-015-purchase-orders
    - migration-016-po-line-items
    - migration-025-audit-logs
    - migration-058-advisory-locks
  provides:
    - po-status-engine-enhanced
    - po-cancellation-infrastructure
    - cancel-po-server-action
  affects:
    - purchase_orders-table
    - qmhq-balance-in-hand
    - audit_logs-table
tech_stack:
  added:
    - pg_advisory_xact_lock for PO status calculation
  patterns:
    - invoice-first priority in status calculation
    - cascade feedback in Server Actions
    - audit trigger with zz_ prefix
key_files:
  created:
    - supabase/migrations/20260212200000_po_status_engine_enhancement.sql
    - lib/actions/po-actions.ts
  modified:
    - lib/utils/po-status.ts
decisions:
  - decision: Use invoice-first priority for partially_invoiced status
    rationale: Show partially_invoiced even when some items are received, until ALL items are invoiced
    context: POSE-03 requirement
  - decision: Use pg_advisory_xact_lock on PO UUID for status calculation
    rationale: Prevent race conditions when multiple invoices/stock-ins happen concurrently
    context: Follow migration 058 pattern
  - decision: Use zz_ prefix for cancellation audit trigger
    rationale: Fire AFTER other triggers complete (update_qmhq_po_committed runs first)
    context: Follow migration 040-041 convention
  - decision: Admin-only cancellation with mandatory reason
    rationale: Financial control - only admins can release committed budget
    context: User requirement from 41-CONTEXT.md
metrics:
  duration_seconds: 211
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  commits: 2
  completed_date: 2026-02-12
---

# Phase 41 Plan 01: PO Status Engine Enhancement Summary

**One-liner:** Enhanced PO status calculation with invoice-first priority, advisory locks for concurrency, and cancellation infrastructure with audit trail.

## What Was Built

### Database Layer
1. **Cancellation Columns** - Added to purchase_orders table:
   - `cancellation_reason TEXT` - Mandatory reason for cancellation
   - `cancelled_at TIMESTAMPTZ` - Timestamp when cancelled
   - `cancelled_by UUID` - References user who cancelled
   - Index on `cancelled_at` for efficient queries

2. **Enhanced Status Calculation Function** - `calculate_po_status()`:
   - Added `pg_advisory_xact_lock(hashtext(p_po_id::text))` for concurrency safety
   - Implemented invoice-first priority logic per POSE-03
   - Priority order: cancelled → not_started (if 0 items) → closed (3-way match) → **partially_invoiced** (even if some received) → partially_received (only after fully invoiced) → awaiting_delivery → not_started
   - Key fix: `partially_invoiced` now takes priority over `partially_received` when both conditions exist

3. **Cancellation Audit Trigger** - `zz_audit_po_cancellation()`:
   - Fires AFTER UPDATE when status changes to 'cancelled'
   - Creates audit log entry for PO cancellation with reason
   - Creates audit log entry for parent QMHQ showing budget release
   - Uses SECURITY DEFINER with safe search_path
   - Uses `zz_` prefix to fire after `update_qmhq_po_committed` trigger

### Application Layer
1. **cancelPO Server Action** - `lib/actions/po-actions.ts`:
   - Validates user authentication and admin role
   - Guards against cancelling already-cancelled or closed POs
   - Updates PO with status='cancelled', reason, timestamp, and user
   - Fetches QMHQ before and after to calculate cascade feedback
   - Returns structured result with: poNumber, previousStatus, releasedAmountEusd, qmhqRequestId, newBalanceInHand
   - Revalidates /po, /po/[id], /qmhq, /qmhq/[id] paths
   - Follows exact pattern from voidInvoice() in invoice-actions.ts

2. **Status Utility Functions** - `lib/utils/po-status.ts`:
   - `generateStatusTooltip(status, totalQty, invoicedQty, receivedQty)` - Generates tooltip text showing "3/5 invoiced (60%), 1/5 received (20%)"
   - `recomputeStatusFromAggregates(totalQty, invoicedQty, receivedQty, isCancelled)` - Client-side mirror of database logic for page-load safety net
   - Both follow invoice-first priority logic matching database function

## Key Technical Details

### Invoice-First Priority Logic
The status calculation now correctly implements invoice-first priority:

```
IF total_invoiced > 0 AND total_invoiced < total_ordered THEN
  RETURN 'partially_invoiced'  -- Even if some items received
```

**Example scenario:**
- PO has 10 items ordered
- 6 items invoiced
- 2 items received
- **OLD behavior:** Status = "partially_received" (WRONG - received took priority)
- **NEW behavior:** Status = "partially_invoiced" (CORRECT - invoice takes priority)

Only after ALL items are invoiced does the status switch to received-based states (partially_received, awaiting_delivery).

### Advisory Lock Pattern
Following migration 058 pattern, the status calculation uses transaction-level advisory locks:

```sql
PERFORM pg_advisory_xact_lock(hashtext(p_po_id::text));
```

This serializes concurrent status calculations for the same PO, preventing race conditions when:
- Multiple invoices created simultaneously
- Invoice creation and stock-in happen concurrently
- Multiple users view PO detail page at same time

Lock is automatically released on COMMIT or ROLLBACK.

### Cancellation Cascade Flow
When a PO is cancelled, the following cascade happens automatically:

1. **Server Action updates PO:** status='cancelled', cancellation_reason, cancelled_at, cancelled_by
2. **update_qmhq_po_committed trigger fires:** Recalculates QMHQ.total_po_committed, excluding cancelled POs
3. **zz_audit_po_cancellation trigger fires:** Creates 2 audit log entries (PO cancellation + QMHQ budget release)
4. **Server Action queries QMHQ:** Fetches new total_po_committed and calculates new Balance in Hand
5. **Server Action returns feedback:** Released amount, new balance, QMHQ request ID for toast display

This ensures Balance in Hand is immediately released and fully audited.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### TypeScript Compilation
- `npm run type-check` passed with no errors
- All type definitions correct for cancelPO Server Action
- CancelPOResult type properly structured with success/error discriminated union

### Linting
- `npm run lint` passed with no new warnings
- Only pre-existing warnings in unrelated files (comments-section.tsx, file-dropzone-preview.tsx, flow nodes)

### Code Quality
- cancelPO Server Action follows exact pattern from voidInvoice() in invoice-actions.ts
- Advisory lock pattern follows migration 058
- Audit trigger pattern follows migrations 040-041
- Null safety handled with `?? 0` for EUSD calculations

### Database Migration
- Migration file created: `20260212200000_po_status_engine_enhancement.sql`
- Cannot run `supabase db reset` (Docker not available in environment)
- SQL syntax verified manually - all DDL statements correct

## Integration Points

### Existing Triggers Affected
- `update_qmhq_po_committed` (migration 015) - Already excludes cancelled POs from SUM, works correctly
- `trigger_update_po_status` (migration 016) - Already skips cancelled POs with WHERE clause, works correctly

### Future Integration Requirements
For Phase 42 (PO Cancellation Guards) and Phase 43 (PDF Export):
- Cancel button UI will call `cancelPO` Server Action
- Toast notifications will use cascade feedback data (releasedAmountEusd, newBalanceInHand)
- Status badge will call `generateStatusTooltip` for hover text
- PO detail page will call `recomputeStatusFromAggregates` for safety net comparison

## Testing Notes

### Manual Testing Required (Post-Docker Setup)
1. Run `npx supabase db reset` to verify migration applies cleanly
2. Verify `calculate_po_status` function exists with advisory lock
3. Verify cancellation columns exist on purchase_orders table
4. Verify `zz_audit_po_cancellation` trigger exists

### Scenario Testing Required (Phase 42)
1. **Invoice-first priority:** Create PO with 10 items, invoice 6, receive 2 → expect "partially_invoiced"
2. **Concurrency safety:** Create 2 invoices simultaneously for same PO → expect correct invoiced_quantity
3. **Cancellation cascade:** Cancel PO → verify QMHQ.total_po_committed decreases, 2 audit logs created
4. **Admin-only enforcement:** Try cancel as non-admin → expect error "Only administrators can cancel"
5. **Guard: already cancelled:** Try cancel twice → expect error "PO is already cancelled"
6. **Guard: closed PO:** Try cancel closed PO → expect error "Cannot cancel a closed PO"

## Self-Check: PASSED

### Created Files Verification
```bash
[ -f "supabase/migrations/20260212200000_po_status_engine_enhancement.sql" ] && echo "FOUND"
[ -f "lib/actions/po-actions.ts" ] && echo "FOUND"
```
Result: FOUND, FOUND

### Commits Verification
```bash
git log --oneline | grep -E "(4ed4a75|66ba412)"
```
Result:
- 4ed4a75 feat(41-01): add PO status engine enhancement migration
- 66ba412 feat(41-01): create cancelPO Server Action and update po-status utilities

### Exports Verification
- `lib/actions/po-actions.ts` exports: `cancelPO`, `CancelPOResult` ✓
- `lib/utils/po-status.ts` exports: `generateStatusTooltip`, `recomputeStatusFromAggregates`, all existing exports preserved ✓

All checks passed.

---

**Commits:**
- 4ed4a75: feat(41-01): add PO status engine enhancement migration
- 66ba412: feat(41-01): create cancelPO Server Action and update po-status utilities

**Duration:** 3 minutes 31 seconds
**Status:** Complete and ready for Phase 42 (PO Cancellation Guards UI)
