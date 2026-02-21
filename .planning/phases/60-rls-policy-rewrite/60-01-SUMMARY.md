---
phase: 60-rls-policy-rewrite
plan: 01
subsystem: database
tags: [rls, postgres, supabase, rbac, permission-matrix, has_permission]

# Dependency graph
requires:
  - phase: 59-permission-schema-migration
    provides: "has_permission() function, user_permissions table, permission_resource/level enums"
provides:
  - "Complete RLS rewrite: 102 permission-matrix-aware policies across 25 tables"
  - "users.role column, user_role enum, get_user_role() function dropped"
  - "handle_new_user() updated to remove role column insert"
  - "TypeScript User type cleaned of role field"
  - "TODO Phase 62 markers on all frontend role references"
affects:
  - 62-frontend-permission-enforcement
  - 61-permission-management-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permission gate: has_permission(resource, level) as sole RLS authorization check"
    - "Recursion-safe pattern: user_permissions table uses direct EXISTS subquery (not has_permission) to avoid circular dependency"
    - "Cross-cutting tables (file_attachments, comments) inherit parent entity permission via attachment_entity_resource() and comment_entity_resource() helper functions"
    - "Approval layer permissions: stock_out_approvals uses OR across sor_l1/sor_l2/sor_l3 resources"
    - "Reference/config tables universally readable (USING true), admin-writable only"

key-files:
  created:
    - "supabase/migrations/20260221100000_rls_permission_matrix_rewrite.sql"
  modified:
    - "types/database.ts"
    - "components/providers/auth-provider.tsx"
    - "components/layout/sidebar.tsx"
    - "components/layout/header.tsx"
    - "lib/supabase/middleware.ts"
    - "lib/actions/po-actions.ts"
    - "app/(dashboard)/dashboard/page.tsx"
    - "app/(dashboard)/qmhq/layout.tsx"
    - "app/(dashboard)/qmhq/new/page.tsx"
    - "app/(dashboard)/qmhq/[id]/page.tsx"
    - "app/(dashboard)/qmhq/[id]/edit/page.tsx"
    - "app/(dashboard)/qmrl/new/page.tsx"
    - "app/(dashboard)/qmrl/[id]/page.tsx"
    - "app/(dashboard)/admin/flow-tracking/layout.tsx"
    - "app/(dashboard)/admin/users/page.tsx"
    - "app/(dashboard)/admin/users/user-dialog.tsx"
    - "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx"
    - "app/api/admin/reactivate-user/route.ts"
    - "app/api/admin/invite-user/route.ts"
    - "app/api/admin/deactivate-user/route.ts"

key-decisions:
  - "user_permissions table policies use direct EXISTS subquery (not has_permission()) to prevent circular recursion"
  - "file_attachments and comments inherit parent entity permission via attachment_entity_resource() and comment_entity_resource() IMMUTABLE helper functions"
  - "stock_out_approvals: SELECT/INSERT/UPDATE use OR across sor_l1/sor_l2/sor_l3, DELETE is admin-only"
  - "UserRole type kept as deprecated string union in database.ts to avoid breaking 15+ frontend files — Phase 62 cleans up"
  - "useUserRole() hook returns null permanently until Phase 62 — role-based UI logic disabled"
  - "Role-based route guards in middleware commented out with TODO Phase 62 markers"

patterns-established:
  - "has_permission(resource, 'view') for SELECT policies, has_permission(resource, 'edit') for INSERT/UPDATE/DELETE"
  - "Reference tables: USING (true) for SELECT, has_permission('admin', 'edit') for writes"
  - "Cross-cutting tables: use helper function to map entity_type text to permission_resource enum"

requirements-completed:
  - PERM-09

# Metrics
duration: 10min
completed: 2026-02-21
---

# Phase 60 Plan 01: RLS Permission Matrix Rewrite Summary

**102 RLS policies across 25 tables rewritten to use has_permission(), users.role column and user_role enum dropped, TypeScript types updated with zero build errors**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-21T08:08:05Z
- **Completed:** 2026-02-21T08:18:03Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Single migration file drops all 100+ legacy RLS policies and creates 102 fresh permission-matrix policies using `has_permission()`
- Legacy role infrastructure dropped: `get_user_role()`, `has_role()`, `users.role` column, `user_role` enum
- `handle_new_user()` trigger updated to stop inserting `role` column before column drop
- Helper functions `can_view_sor_request()` and `delete_file_attachment()` updated to use permission checks
- New helper functions `attachment_entity_resource()` and `comment_entity_resource()` for cross-cutting table authorization
- TypeScript User type cleaned of `role` field; `npm run type-check` and `npm run lint` pass cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RLS permission-matrix migration** - `328e226` (feat)
2. **Task 2: Update TypeScript types and verify build** - `2a1e206` (feat)

## Files Created/Modified
- `supabase/migrations/20260221100000_rls_permission_matrix_rewrite.sql` - Complete RLS rewrite migration (861 lines)
- `types/database.ts` - Removed role from User Row/Insert/Update, removed user_role enum and get_user_role/has_role functions
- `components/providers/auth-provider.tsx` - useUserRole() returns null with TODO Phase 62
- `components/layout/sidebar.tsx` - userRole hardcoded to null, sidebar role display commented out
- `components/layout/header.tsx` - Role display in header replaced with placeholder
- `lib/supabase/middleware.ts` - Role-based route blocking disabled (TODO Phase 62), role removed from select
- `lib/actions/po-actions.ts` - Two role checks replaced with TODO Phase 62 comments
- 13 additional frontend files - role column removed from queries, runtime checks commented out

## Decisions Made
- **Recursion-safe user_permissions policies:** All four user_permissions policies use direct `EXISTS (SELECT 1 FROM public.user_permissions ...)` subquery instead of `has_permission()` to prevent infinite recursion through the function that reads user_permissions.
- **Deprecated UserRole type kept:** Rather than removing `UserRole` entirely (which would cause 15+ compile errors), kept it as a deprecated string union `"admin" | "qmrl" | "qmhq"` with TODO Phase 62 comment. Phase 62 will replace all usages with permission-based checks.
- **Role-based guards disabled not removed:** Middleware route blocking, layout-level role guards, and role-dependent redirects were commented out with TODO Phase 62 markers. This is intentional — Phase 62 replaces these with permission checks, not this phase.
- **Cross-cutting tables use IMMUTABLE helper functions:** `attachment_entity_resource()` and `comment_entity_resource()` are `IMMUTABLE` PL/pgSQL functions that map `entity_type` text to `permission_resource` enum — this allows Postgres to potentially cache results and keeps policies readable.

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Fixed recursion in user_permissions policies**
- **Found during:** Task 1 (migration creation)
- **Issue:** Plan specified using `has_permission()` in user_permissions policies, but `has_permission()` reads from `user_permissions` — this creates circular dependency causing infinite recursion
- **Fix:** Used direct `EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND up.resource = 'admin' AND up.level = 'edit')` subquery for all four user_permissions policies, exactly as the plan's code example specified
- **Files modified:** `supabase/migrations/20260221100000_rls_permission_matrix_rewrite.sql`
- **Verification:** Plan explicitly documented this pattern in Section B — followed as written
- **Committed in:** 328e226 (Task 1 commit)

Note: This was actually specified in the plan — not a deviation. Documented for clarity.

---

**Total deviations:** 0 — plan executed exactly as written (recursion-safe pattern was specified in plan)
**Impact on plan:** None.

## Issues Encountered
- **Many frontend files referenced `user.role`:** After removing `role` from User type, TypeScript errors appeared in 20+ files. Applied the plan's prescribed approach: comment out role-dependent code, add `// TODO Phase 62` markers, and use safe fallbacks (null/false) so the build passes. All pre-existing lint warnings are from unrelated code (useEffect deps, img tags) — not introduced by this phase.

## User Setup Required
None — database migration runs via `npx supabase db push` or local `npx supabase db reset`.

## Next Phase Readiness
- Phase 60 complete: all RLS policies use `has_permission()`, legacy role infrastructure dropped
- Phase 61 (Permission Management UI) can build the admin interface for editing `user_permissions` rows
- Phase 62 (Frontend enforcement) should replace all `// TODO Phase 62` markers with actual `has_permission` RPC calls and `usePermissions()` hook based on the new permission matrix
- The `UserRole` deprecated type alias can be fully removed in Phase 62 once all usages are replaced

---
*Phase: 60-rls-policy-rewrite*
*Completed: 2026-02-21*
