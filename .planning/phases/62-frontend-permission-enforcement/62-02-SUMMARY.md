---
phase: 62-frontend-permission-enforcement
plan: "02"
subsystem: auth
tags: [permissions, rbac, nextjs, supabase, user-permissions, typescript]

# Dependency graph
requires:
  - phase: 62-01
    provides: ROUTE_RESOURCE_MAP, useResourcePermissions() hook, user_permissions table wired in middleware
  - phase: 61-permission-management-ui
    provides: user_permissions table typed in TypeScript, PermissionResource/PermissionLevel enums
  - phase: 60-rls-policy-rewrite
    provides: users.role column dropped, RLS uses has_permission(), user_permissions table populated

provides:
  - All CRUD pages gate Create/Edit/Delete buttons via useResourcePermissions().canEdit()
  - ClickableStatusBadge clickability gated via canEdit(entityType) — fixes non-clickable status badge for all users
  - SOR approve/execute restored: canApprove = canEdit("sor_l1"), canExecute = canEdit("sor")
  - deactivate-user and reactivate-user API routes reject non-admin callers with 403
  - PO cancel/unlock server actions reject callers without po edit permission
  - Deprecated UserRole type fully removed from types/database.ts and types/index.ts

affects:
  - 63-auto-status
  - 64-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "canEdit(resource) replaces all can(create/update/delete, legacyResource) calls"
    - "Server-action permission gate: query user_permissions table, check level === 'edit', return error/403 if not"
    - "Resource mapping: admin resource covers all legacy admin-page entities (departments, contacts, suppliers, categories, statuses, users)"

key-files:
  created: []
  modified:
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/qmrl/new/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/edit/page.tsx
    - app/(dashboard)/qmhq/new/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - app/(dashboard)/admin/departments/page.tsx
    - app/(dashboard)/admin/contacts/page.tsx
    - app/(dashboard)/admin/suppliers/page.tsx
    - app/(dashboard)/admin/categories/page.tsx
    - app/(dashboard)/admin/statuses/page.tsx
    - app/(dashboard)/admin/standard-units/page.tsx
    - app/(dashboard)/admin/users/page.tsx
    - components/status/clickable-status-badge.tsx
    - app/api/admin/deactivate-user/route.ts
    - app/api/admin/reactivate-user/route.ts
    - lib/actions/po-actions.ts
    - lib/hooks/use-permissions.ts
    - types/database.ts
    - types/index.ts
    - components/providers/auth-provider.tsx

key-decisions:
  - "canEdit('admin') used for all admin page entities — departments, contacts, suppliers, categories, statuses, standard-units, users all map to admin resource"
  - "ClickableStatusBadge: canEdit(entityType as DbPermissionResource) — qmrl/qmhq entity types match DB resource names directly"
  - "SOR detail: canApprove = canEdit('sor_l1'), canExecute = canEdit('sor') — sor_l1 gates L1 approval, sor gates execution"
  - "Server actions check user_permissions table directly (not RLS alone) as defense in depth per PERM-08"
  - "UserRole removed entirely from types/database.ts and types/index.ts — local type alias kept in use-permissions.ts for legacy permissionMatrix"
  - "usePermissions() kept in file (dead code) with @deprecated JSDoc — call sites all migrated to useResourcePermissions()"

patterns-established:
  - "All button visibility gates: canEdit(resource) or canView(resource) from useResourcePermissions()"
  - "Server mutation gates: query user_permissions, check level === 'edit', return 403/error if insufficient"

requirements-completed: [PERM-07, PERM-08]

# Metrics
duration: 12min
completed: 2026-02-21
---

# Phase 62 Plan 02: Frontend Permission Enforcement Summary

**All usePermissions() call sites migrated to useResourcePermissions(); server actions enforce edit-level permission via user_permissions table; deprecated UserRole type fully removed**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-21T11:15:31Z
- **Completed:** 2026-02-21T11:27:52Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- Replaced all 17 files using legacy `can()` hook with `useResourcePermissions().canEdit()`/`canView()`, restoring button gating that was broken since Phase 60 dropped users.role
- Fixed critical bug: ClickableStatusBadge was non-clickable for ALL users because `can("update", entityType)` always returned false; now uses `canEdit(entityType)` from user_permissions
- SOR approve/execute buttons restored with real permission checks (`sor_l1` for L1 approval, `sor` for execution) instead of hardcoded `false`
- Server actions (deactivate-user, reactivate-user, cancelPO, unlockClosedPO) now enforce permissions via `user_permissions` table query (PERM-08 defense in depth)
- Deprecated `UserRole` type removed from TypeScript types — zero consumer imports remaining

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace legacy usePermissions() with useResourcePermissions() on all detail/list pages** - `ca2c2c8` (feat)
2. **Task 2: Server-action permission rejection and legacy cleanup** - `1066dfd` (feat)

**Plan metadata:** (committed below in final commit)

## Files Created/Modified

- `app/(dashboard)/admin/departments/page.tsx` - canEdit("admin") replaces can(create/update/delete, "departments")
- `app/(dashboard)/admin/contacts/page.tsx` - canEdit("admin") replaces can(create/update/delete, "contact_persons")
- `app/(dashboard)/admin/suppliers/page.tsx` - canEdit("admin") replaces can(create/update/delete, "suppliers")
- `app/(dashboard)/admin/categories/page.tsx` - canEdit("admin") replaces can(create/update/delete, "categories")
- `app/(dashboard)/admin/statuses/page.tsx` - canEdit("admin") replaces can(create/update/delete, "statuses")
- `app/(dashboard)/admin/standard-units/page.tsx` - canEdit("admin") replaces can(create/update/delete, "categories" proxy)
- `app/(dashboard)/admin/users/page.tsx` - canEdit("admin") replaces can(create/update/delete, "users")
- `app/(dashboard)/qmrl/[id]/page.tsx` - canEdit("qmrl")/canView("qmhq") for buttons/tabs; removed role display TODO comments; canDeleteFile uses canEdit("qmrl")
- `app/(dashboard)/qmrl/new/page.tsx` - removed TODO Phase 62 role display comment
- `app/(dashboard)/qmhq/[id]/page.tsx` - 5 can() calls replaced; canDeleteFile updated; TODO comment removed
- `app/(dashboard)/qmhq/[id]/edit/page.tsx` - removed TODO Phase 62 role column comment
- `app/(dashboard)/qmhq/new/page.tsx` - removed 2x TODO Phase 62 comments
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - canApprove = canEdit("sor_l1"), canExecute = canEdit("sor")
- `app/(dashboard)/inventory/stock-out-requests/page.tsx` - canEdit("sor") for New Request button
- `app/(dashboard)/po/[id]/page.tsx` - canEdit("po") replaces can(update/delete, "purchase_orders")
- `app/(dashboard)/invoice/[id]/page.tsx` - removed unused usePermissions import
- `components/status/clickable-status-badge.tsx` - canEdit(entityType as DbPermissionResource) fixes non-clickable badge bug
- `app/api/admin/deactivate-user/route.ts` - queries user_permissions, returns 403 if not admin edit
- `app/api/admin/reactivate-user/route.ts` - same admin permission check
- `lib/actions/po-actions.ts` - cancelPO and unlockClosedPO check po resource edit level
- `lib/hooks/use-permissions.ts` - local UserRole type alias; @deprecated on usePermissions()
- `types/database.ts` - deprecated UserRole type removed
- `types/index.ts` - UserRole removed from re-exports
- `components/providers/auth-provider.tsx` - inline union type in useUserRole() return

## Decisions Made

- `canEdit("admin")` covers all legacy admin-page entities (departments, contacts, suppliers, categories, statuses, standard-units, users) — single resource covers all admin CRUD
- ClickableStatusBadge entityType ("qmrl" | "qmhq") matches DB resource names directly — safe cast to DbPermissionResource
- SOR detail: `sor_l1` gates L1 quantity approval; `sor` gates execution (warehouse fulfillment)
- Server actions check `user_permissions` table directly — this is defense in depth beyond RLS per PERM-08
- `UserRole` type removed entirely since all call sites migrated; legacy `usePermissions()` kept in file as dead code with `@deprecated` JSDoc
- `fetchQMRL` callback dependency array updated to include `canView` (used in QMHQ visibility check)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 62 complete. All TODO Phase 62 markers resolved. usePermissions() fully replaced.
- Phase 63 (Auto Status) and Phase 64 (Dashboard) can proceed.
- Build and type-check both pass cleanly.

## Self-Check: PASSED

- All 10 key files verified to exist on disk
- Commits ca2c2c8 and 1066dfd verified in git log
- npm run type-check: zero errors
- npm run build: clean build
- Zero TODO Phase 62 markers in runtime code
- Zero usePermissions() calls in app/ and components/
- canApprove/canExecute = false: zero results
- user_permissions queried in 4 locations across server actions

---
*Phase: 62-frontend-permission-enforcement*
*Completed: 2026-02-21*
