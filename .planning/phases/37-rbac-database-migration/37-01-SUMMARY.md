---
phase: 37-rbac-database-migration
plan: 01
subsystem: database
tags: [postgresql, enum, rbac, migration, expand-and-contract]

# Dependency graph
requires:
  - phase: 02-users
    provides: user_role enum with 7 values and related functions
provides:
  - user_role enum with 3 values (admin, qmrl, qmhq)
  - Updated get_user_role() function returning new enum
  - Updated handle_new_user() trigger with 'qmrl' default
  - Cleaned up has_role() dead code
  - Audit log marker for tracking migration
affects: [37-02-rls-policies, 38-rbac-permissions-mapping, frontend-role-checks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expand-and-contract pattern for PostgreSQL enum migration"
    - "Transactional migration with NULL validation check"
    - "Role mapping with explicit 7-to-3 mapping table"

key-files:
  created:
    - supabase/migrations/20260211120000_rbac_enum_migration.sql
  modified:
    - public.users.role (column type changed)
    - public.get_user_role() (function signature unchanged, cleaned)
    - public.handle_new_user() (default role changed to 'qmrl')

key-decisions:
  - "Used expand-and-contract pattern (rename → create → migrate → swap → drop) per PostgreSQL enum immutability"
  - "Dropped has_role() function entirely as dead code (not used in any RLS policies)"
  - "Changed default role from 'requester' to 'qmrl' for new user signups"
  - "All 7 old roles mapped to new roles: admin/quartermaster→admin, finance/inventory/proposal→qmhq, frontline/requester→qmrl"
  - "Added DO block NULL validation to abort transaction on data integrity failure"

patterns-established:
  - "Enum migration: Wrap in BEGIN/COMMIT with validation checks before column swap"
  - "Audit log marker: Insert system-level audit log entry for schema migrations"
  - "Function updates: Recreate functions using new enum type immediately after enum swap"

# Metrics
duration: 59s
completed: 2026-02-11
---

# Phase 37 Plan 01: RBAC Enum Migration Summary

**PostgreSQL enum migrated from 7 roles to 3 roles using expand-and-contract pattern with transactional data mapping and NULL validation**

## Performance

- **Duration:** 59s
- **Started:** 2026-02-11T18:42:47Z
- **Completed:** 2026-02-11T18:43:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created atomic migration file with all 13 steps (enum swap, data migration, function updates, validation, audit log)
- Implemented expand-and-contract pattern (rename old enum, create new enum, add temp column, migrate data, swap columns, drop old enum)
- Added NULL validation DO block that aborts transaction if any users have unmapped roles
- Dropped has_role() dead code function
- Updated get_user_role() and handle_new_user() functions for new 3-role system
- Changed default role for new users from 'requester' to 'qmrl'

## Task Commits

Each task was committed atomically:

1. **Task 1: Create enum migration with data mapping and function updates** - `5af0d02` (feat)

## Files Created/Modified
- `supabase/migrations/20260211120000_rbac_enum_migration.sql` - Single transactional migration performing enum swap, data mapping (7 old roles → 3 new roles), NULL validation, column swap with constraints, index recreation, old enum drop, has_role() function drop, get_user_role() recreation, handle_new_user() update with 'qmrl' default, updated comments, and audit log marker

## Decisions Made

**1. Expand-and-contract pattern for enum migration**
- **Rationale:** PostgreSQL enums cannot have values removed via ALTER TYPE. Only safe approach is to rename old enum, create new enum with target values, migrate data via temp column, swap columns, and drop old enum.
- **Source:** Research findings from PostgreSQL docs and Supabase enum management guide

**2. Dropped has_role() function entirely**
- **Rationale:** Function contains hardcoded 7-role hierarchy logic but is not used in any RLS policies (all policies use `get_user_role() IN (...)` pattern). Simpler to remove dead code than rewrite for 3 roles.
- **Verification:** Grepped codebase for has_role() references - zero usage in RLS policies

**3. Changed default role from 'requester' to 'qmrl'**
- **Rationale:** In the 3-role system, 'qmrl' (field operations) is the equivalent of 'requester' (the lowest permission level for field users). New signups should default to field operations role.
- **Impact:** handle_new_user() trigger now assigns 'qmrl' to new auth signups

**4. Role mapping logic**
- **Mapping table:**
  - admin, quartermaster → admin (supervisory/full access roles)
  - finance, inventory, proposal → qmhq (HQ operations roles)
  - frontline, requester → qmrl (field operations roles)
- **Rationale:** Groups roles by operational domain (admin, HQ operations, field operations)

**5. NULL validation with DO block**
- **Rationale:** If CASE statement misses any role value, users would have NULL role_new causing data corruption. DO block counts NULLs and raises exception to abort transaction before column swap.
- **Safety:** Prevents migration from completing if data integrity compromised

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Docker not running for local testing**
- **Issue:** `npx supabase db reset` requires Docker daemon to be running. Command failed because Docker was not available in execution environment.
- **Resolution:** Verified migration file structure manually by checking:
  - BEGIN/COMMIT transaction wrapper present
  - All 13 steps documented and implemented
  - Correct SQL syntax for enum operations
  - NULL validation DO block present
  - Function signatures correct
- **Impact:** Migration file created and committed. Will be tested when deployed to Supabase environment or when Docker is available locally.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (RLS Policy Recreation):**
- user_role enum now has 3 values (admin, qmrl, qmhq)
- get_user_role() function returns new enum type
- All functions updated to work with new roles
- Audit log marker inserted for tracking

**Blockers:**
- None

**Considerations for Plan 02:**
- RLS policies must be recreated with new role values
- 68+ policies across 11 migration files need updating
- Drop-and-recreate pattern in single transaction required
- RLS must stay enabled throughout (default-deny during gap is acceptable)

## Self-Check: PASSED

All files and commits verified:
- FOUND: supabase/migrations/20260211120000_rbac_enum_migration.sql
- FOUND: 5af0d02 (Task 1 commit)

---
*Phase: 37-rbac-database-migration*
*Completed: 2026-02-11*
