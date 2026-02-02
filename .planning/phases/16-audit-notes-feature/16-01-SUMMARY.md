---
phase: 16-audit-notes-feature
plan: 01
subsystem: audit
tags: [postgresql, audit-logs, rpc, status-change, user-notes]

# Dependency graph
requires:
  - phase: 10-management-dashboards
    provides: Audit log infrastructure with notes field
provides:
  - Status update RPC function with note parameter
  - Trigger deduplication to prevent duplicate audit entries
  - UI flow for capturing optional notes during status changes
affects: [history, audit, status-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC function with SECURITY DEFINER and hardened search_path"
    - "Trigger deduplication via time-window check (2 seconds)"
    - "Application-level audit creation before entity update"

key-files:
  created:
    - supabase/migrations/048_status_update_with_note.sql
  modified:
    - components/status/status-change-dialog.tsx
    - components/status/clickable-status-badge.tsx
    - types/database.ts

key-decisions:
  - "RPC creates audit entry FIRST, then updates status - ensures deduplication check works"
  - "2-second time window for duplicate detection - balances race condition protection vs. legitimate rapid changes"
  - "256 character limit on notes - short commit-message style per CONTEXT.md"
  - "Note preserved on error - dialog stays open with note intact if update fails"

patterns-established:
  - "RPC pattern for complex mutations with audit trail: create audit entry before entity update"
  - "Trigger deduplication: check for recent entries (time window + matching fields) before insert"
  - "Error handling in onConfirm: throw to prevent dialog close and preserve user input"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 16 Plan 01: Audit Notes Feature Summary

**Status changes on QMRL/QMHQ now capture optional user notes (max 256 chars) via RPC function with trigger deduplication preventing duplicate audit entries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T10:09:00Z
- **Completed:** 2026-02-02T10:12:27Z
- **Tasks:** 2 (plus verification)
- **Files modified:** 4

## Accomplishments
- RPC function `update_status_with_note` creates audit entry with note, then updates entity status
- Audit trigger modified with 2-second deduplication check to skip when app already created entry
- StatusChangeDialog passes note parameter to parent callback
- ClickableStatusBadge calls RPC instead of direct update, preserves note on error
- Database types extended with RPC function signature

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RPC function and trigger deduplication** - `fd8195f` (feat)
2. **Task 2: Wire UI to pass note through status update flow** - `6ae2fdd` (feat)

## Files Created/Modified

### Created
- `supabase/migrations/048_status_update_with_note.sql` - RPC function and modified audit trigger with deduplication

### Modified
- `components/status/status-change-dialog.tsx` - Updated onConfirm signature to accept note parameter, added maxLength={256}, updated help text
- `components/status/clickable-status-badge.tsx` - Replaced direct Supabase update with RPC call, added error handling to preserve note on failure
- `types/database.ts` - Added update_status_with_note RPC function type definition

## Decisions Made

**1. RPC creates audit entry FIRST, then updates status**
- Rationale: Ensures audit entry exists when trigger's deduplication check runs, preventing race conditions

**2. 2-second time window for duplicate detection**
- Rationale: Balances protection against race conditions vs. allowing legitimate rapid status changes by same user

**3. Note preserved on error**
- Rationale: If status update fails, user shouldn't lose typed note - throw error to keep dialog open with note intact

**4. 256 character limit**
- Rationale: Per CONTEXT.md decision - keeps notes short and commit-message style rather than essay-length

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward with existing infrastructure (notes field already in schema, History tab already displays notes).

## Next Phase Readiness

**Ready for verification:**
- RPC function deployed (migration 048)
- UI updated to call RPC with note
- TypeScript types updated
- Build succeeds

**Verification needed:**
- Manual testing of full flow (Task 3):
  1. Status change WITH note - verify note appears in History
  2. Status change WITHOUT note - verify still works
  3. Rapid status changes - verify both recorded without duplicates
  4. Both QMRL and QMHQ entities
  5. Error handling - note preserved on failure

**Database verification queries:**
```sql
-- Verify RPC exists
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'update_status_with_note';

-- Verify no duplicate audit entries
SELECT entity_id, action, field_name, new_value, COUNT(*)
FROM audit_logs
WHERE action = 'status_change'
  AND changed_at > NOW() - INTERVAL '1 hour'
GROUP BY entity_id, action, field_name, new_value
HAVING COUNT(*) > 1;
```

## Technical Details

### RPC Function Flow
1. Validate entity type (qmrl or qmhq)
2. Get current status_id
3. If note provided: Create audit entry with note FIRST
4. Update entity status (triggers audit_trigger)
5. Trigger checks for recent duplicate and skips if found
6. Return success/error JSON

### Deduplication Logic
Trigger checks for existing audit entry within 2 seconds with matching:
- entity_type (table name)
- entity_id
- action ('status_change')
- field_name ('status_id')
- new_value (new status UUID)

If match found, RETURN NEW without creating duplicate entry.

### Error Handling
- RPC validates entity type and existence
- Returns JSONB with success/error/message fields
- UI checks data.success and throws on error
- Dialog stays open on error, preserving note for retry

---
*Phase: 16-audit-notes-feature*
*Completed: 2026-02-02*
