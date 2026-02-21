---
phase: 59-permission-schema-migration
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, rbac, permissions, migrations, typescript]

requires:
  - phase: 37-rbac-database-migration
    provides: "3-role user_role enum (admin/qmrl/qmhq) and users.role column that this migration reads from"

provides:
  - "user_permissions table with (user_id, resource, level) schema — 16 resources × N users"
  - "permission_resource enum (16 values: system_dashboard through admin)"
  - "permission_level enum (edit/view/block)"
  - "check_user_permission(user_id, resource) → level helper function"
  - "has_permission(resource, level) → boolean RLS helper (Phase 60 will use this)"
  - "create_default_permissions(user_id) utility function"
  - "Updated handle_new_user() trigger that seeds 16 Block rows on signup"
  - "TypeScript types: PermissionResource, PermissionLevel, UserPermission, PERMISSION_RESOURCES, PERMISSION_RESOURCE_LABELS, PERMISSION_LEVEL_LABELS"

affects:
  - 60-rls-rewrite
  - 61-permission-management-ui
  - 62-frontend-enforcement

tech-stack:
  added: []
  patterns:
    - "Fail-closed permissions: missing row = block, not error"
    - "Idempotent migration with ON CONFLICT DO NOTHING for safe re-runs"
    - "Validation block inside transaction aborts if row count mismatches"
    - "Backward-compatible migration: role column preserved, new table added alongside"

key-files:
  created:
    - supabase/migrations/20260221000000_permission_schema.sql
    - supabase/migrations/20260221000001_permission_data_migration.sql
  modified:
    - types/database.ts

key-decisions:
  - "Preserved users.role column — not dropped until Phase 60 rewrites 100+ RLS policies to use has_permission()"
  - "Fail-closed default: missing permission row = block, not an error"
  - "create_default_permissions() uses ON CONFLICT DO NOTHING making migration idempotent"
  - "Validation block in data migration raises exception if any user has fewer than 16 rows"
  - "Inactive users get all-block permissions (data integrity), active users get role-mapped permissions"

requirements-completed:
  - PERM-01
  - PERM-10

duration: 5min
completed: 2026-02-21
---

# Phase 59 Plan 01: Permission Schema Migration Summary

**PostgreSQL user_permissions table with 16-resource enum, role-to-permission backfill migration, and TypeScript types — foundation for v1.13 per-user permission matrix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T06:04:25Z
- **Completed:** 2026-02-21T06:09:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `user_permissions` table with `permission_resource` (16-value enum) and `permission_level` (edit/view/block) enums, composite unique constraint, indexes, and RLS policies
- Implemented `check_user_permission()`, `has_permission()`, and `create_default_permissions()` helper functions — Phase 60 will use `has_permission()` directly in RLS policies
- Backfilled all existing users with 16 permission rows each (admin→all-edit, qmrl→scoped, qmhq→scoped, inactive→all-block) with validation that aborts the transaction on mismatch
- Updated `handle_new_user()` trigger to seed 16 Block rows for every new signup
- Added `PermissionResource`, `PermissionLevel`, `UserPermission` TypeScript types plus `PERMISSION_RESOURCES`, `PERMISSION_RESOURCE_LABELS`, `PERMISSION_LEVEL_LABELS` constants for Phase 61 UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create permission schema migration** - `bac332e` (feat)
2. **Task 2: Migrate existing users + TypeScript types** - `117e525` (feat)

## Files Created/Modified

- `supabase/migrations/20260221000000_permission_schema.sql` — Table, enums, indexes, helper functions, updated handle_new_user(), RLS policies
- `supabase/migrations/20260221000001_permission_data_migration.sql` — CTE-based backfill for 3 roles (48 rows), inactive-user block, NULL-role fallback, validation block, audit log entry
- `types/database.ts` — Added PermissionResource, PermissionLevel, UserPermission, UserPermissionInsert, UserPermissionUpdate, PERMISSION_RESOURCES, PERMISSION_RESOURCE_LABELS, PERMISSION_LEVEL_LABELS

## Decisions Made

- **Role column preserved**: users.role is NOT dropped in this phase. 100+ existing RLS policies reference get_user_role() which reads users.role. Phase 60 will rewrite those policies to use has_permission() and then drop the column. Dropping now would break all authorization immediately.
- **Fail-closed**: Missing permission row returns 'block', not an error. Both check_user_permission() and has_permission() implement this.
- **Idempotent migration**: ON CONFLICT DO NOTHING on all INSERT statements makes the data migration safe to re-run without duplicating rows.
- **Transaction-wrapped validation**: If any user ends up with fewer than 16 rows, the RAISE EXCEPTION aborts the entire transaction — no partial state.
- **Inactive users all-block**: Inactive users still get 16 permission rows (all block) for referential integrity — they can't authenticate anyway.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The migrations will be applied when `npx supabase db reset` or `npx supabase db push` is run against the target environment.

## Next Phase Readiness

- Phase 60 (RLS Rewrite) can begin immediately. `has_permission()` function is in place. The pattern is: replace `get_user_role() = 'admin'` guards with `has_permission('admin', 'edit')` and `get_user_role() = 'qmrl'` guards with `has_permission('<resource>', 'view')` or `has_permission('<resource>', 'edit')`.
- Phase 61 (Permission Management UI) can begin immediately. `PERMISSION_RESOURCES`, `PERMISSION_RESOURCE_LABELS`, and `UserPermission` types are available. The admin policy on user_permissions allows full CRUD for admin users.
- Phase 62 (Frontend Enforcement) depends on Phase 60 completing first (so RLS enforces at DB level).

## Self-Check: PASSED

- `supabase/migrations/20260221000000_permission_schema.sql` — FOUND
- `supabase/migrations/20260221000001_permission_data_migration.sql` — FOUND
- `types/database.ts` — FOUND (contains UserPermission)
- Commit `bac332e` — FOUND
- Commit `117e525` — FOUND
- `npm run type-check` — PASSED (no errors)

---
*Phase: 59-permission-schema-migration*
*Completed: 2026-02-21*
