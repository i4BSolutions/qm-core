---
phase: 62-frontend-permission-enforcement
plan: "01"
subsystem: auth
tags: [permissions, rbac, middleware, nextjs, supabase, rls]

# Dependency graph
requires:
  - phase: 61-permission-management-ui
    provides: user_permissions table typed in TypeScript, PermissionResource/PermissionLevel enums
  - phase: 60-rls-policy-rewrite
    provides: users.role column dropped, RLS uses has_permission(), user_permissions table populated

provides:
  - Permission-based route blocking in middleware.ts via user_permissions table query
  - Server-side layout guards for QMHQ and admin/flow-tracking using user_permissions
  - Dashboard page redirects blocked users to /qmrl instead of stalling
  - Header displays "Administrator" or "Operator" based on admin permission level
  - ROUTE_RESOURCE_MAP and getResourceForRoute() utility exported from use-permissions.ts

affects:
  - 62-02 (Plan 02 client-side page guards — uses ROUTE_RESOURCE_MAP from this plan)
  - 63-auto-status
  - 64-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed permission checks: missing user_permissions row = block, not permissive"
    - "Longest-prefix-first route matching for specificity (inventory/stock-in before /inventory)"
    - "Middleware queries only the matching resource row (not all 16) for efficiency"
    - "system_dashboard block falls back to /qmrl, not /dashboard (avoids redirect loop)"

key-files:
  created: []
  modified:
    - lib/supabase/middleware.ts
    - app/(dashboard)/qmhq/layout.tsx
    - app/(dashboard)/admin/flow-tracking/layout.tsx
    - app/(dashboard)/dashboard/page.tsx
    - components/layout/header.tsx
    - lib/hooks/use-permissions.ts

key-decisions:
  - "Middleware fetches only the matched resource's permission row — not all 16 — to minimize DB round trips per request"
  - "system_dashboard block redirects to /qmrl as fallback to avoid /dashboard infinite redirect loop"
  - "admin/flow-tracking requires level === 'edit' (not just non-block); view-only admin access is insufficient for flow tracking"
  - "accessLabel computed from useResourcePermissions().isAdmin — truthy = Administrator, falsy = Operator — matches binary admin/operator model"
  - "ROUTE_RESOURCE_MAP defined in use-permissions.ts (not just middleware) so Plan 02 client-side guards can reuse it without server imports"

patterns-established:
  - "Route-to-resource matching: find first entry where pathname === prefix || pathname.startsWith(prefix + '/')"
  - "Layout guard pattern: fetch permission row, redirect if block or insufficient level"

requirements-completed: [PERM-05, PERM-06]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 62 Plan 01: Frontend Permission Enforcement Summary

**Permission-based route blocking wired in middleware and layout guards using user_permissions table; header replaced hardcoded placeholders with Administrator/Operator label**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T11:08:07Z
- **Completed:** 2026-02-21T11:12:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Middleware now queries `user_permissions` for each protected route and redirects blocked users to `/dashboard` (or `/qmrl` for `system_dashboard`)
- QMHQ and admin/flow-tracking layout guards enforce permission levels server-side
- Dashboard page redirects users with Block on `system_dashboard` to `/qmrl`
- Header `accessLabel` replaces the "Not signed in" and "—" TODO placeholders
- `ROUTE_RESOURCE_MAP` and `getResourceForRoute()` exported from `use-permissions.ts` for Plan 02 reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Middleware permission-based route blocking and layout guards** - `cf1b833` (feat)
2. **Task 2: Header role label and route-to-resource mapping utility** - `66addd9` (feat)

**Plan metadata:** (created below in final commit)

## Files Created/Modified

- `lib/supabase/middleware.ts` - Removed ROLE_BLOCKED_ROUTES, added ROUTE_RESOURCE_MAP and user_permissions query
- `app/(dashboard)/qmhq/layout.tsx` - Server-side permission guard for qmhq resource
- `app/(dashboard)/admin/flow-tracking/layout.tsx` - Server-side permission guard requiring admin edit level
- `app/(dashboard)/dashboard/page.tsx` - Permission check redirects system_dashboard-blocked users to /qmrl
- `components/layout/header.tsx` - useResourcePermissions().isAdmin drives "Administrator"/"Operator" label
- `lib/hooks/use-permissions.ts` - Added ROUTE_RESOURCE_MAP and getResourceForRoute() exports

## Decisions Made

- Middleware fetches only the matched resource's permission row (not all 16) to minimize DB round trips per request
- `system_dashboard` block falls back to `/qmrl` to avoid an infinite redirect loop when `/dashboard` itself is the blocked resource
- `admin/flow-tracking` requires `level === 'edit'` — view-only admin access is insufficient for flow tracking
- `ROUTE_RESOURCE_MAP` placed in `use-permissions.ts` (not just middleware) so Plan 02 client-side guards can import it without triggering server-only modules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 62 Plan 01 complete. Middleware and layout guards now redirect blocked users correctly.
- Plan 02 (client-side page guard components) can import `ROUTE_RESOURCE_MAP` and `getResourceForRoute()` from `lib/hooks/use-permissions.ts` as planned.
- Sidebar filtering (Phase 61) continues to work unchanged — verified via type-check and build.

---
*Phase: 62-frontend-permission-enforcement*
*Completed: 2026-02-21*
