---
phase: 17-attachment-delete-fixes
plan: 01
subsystem: api
tags: [supabase, rls, soft-delete, server-actions]

# Dependency graph
requires:
  - phase: 06-file-attachments
    provides: File attachments infrastructure and RLS policies
provides:
  - Fixed deleteFile server action with fetch-before-update pattern
  - Working attachment deletion for owners and admin/quartermaster
affects: [attachment-features, file-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-before-update pattern for soft-delete with RLS"

key-files:
  created: []
  modified:
    - lib/actions/files.ts

key-decisions:
  - "Use fetch-before-update pattern instead of modifying RLS policies"
  - "Two database round trips acceptable for delete operations"

patterns-established:
  - "Soft-delete with RLS: Always fetch entity info BEFORE setting deleted_at to avoid SELECT policy conflicts"

# Metrics
duration: 5min
completed: 2026-02-06
---

# Phase 17 Plan 01: Attachment Delete Fixes Summary

**Fixed RLS permission error in deleteFile by fetching entity info before soft-delete update**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-06T06:45:33Z
- **Completed:** 2026-02-06T06:50:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed attachment deletion RLS error that affected both owners and admin/quartermaster users
- Implemented fetch-before-update pattern to avoid SELECT policy conflict after soft-delete
- TypeScript compiles and build passes successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix deleteFile query pattern** - `ada87dd` (fix)

**Plan metadata:** Pending

## Files Created/Modified
- `lib/actions/files.ts` - Refactored deleteFile function with fetch-before-update pattern

## Decisions Made
- Used Option A (fix server action) instead of Option B (modify RLS policies) as recommended in research
- Rationale: No migration required, cleaner separation of concerns, extra round trip negligible for delete operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- node_modules not present, required `npm install` before verification
- TypeScript check initially failed due to stale .next cache, resolved by clearing .next directory

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Attachment deletion working for all authorized scenarios
- Ready for Phase 18: QMRL Create Attachments

---
*Phase: 17-attachment-delete-fixes*
*Completed: 2026-02-06*

## Self-Check: PASSED
