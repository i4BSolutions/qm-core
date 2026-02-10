---
phase: 30-user-deactivation
plan: 01
subsystem: api, auth
tags: [supabase-admin-api, middleware, session-management, user-deactivation]

# Dependency graph
requires:
  - phase: 02-database-schema-core-tables
    provides: users table with is_active column
  - phase: 03-authentication
    provides: auth middleware and session management
provides:
  - Admin API endpoints for user deactivation/reactivation
  - Middleware enforcement of is_active status
  - Session invalidation on deactivation
affects: [30-user-deactivation-ui, admin-user-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Admin API for user management (ban_duration, signOut)"
    - "Middleware-level is_active enforcement on every protected request"
    - "Self-deactivation guard at API level"

key-files:
  created:
    - app/api/admin/deactivate-user/route.ts
    - app/api/admin/reactivate-user/route.ts
  modified:
    - lib/supabase/middleware.ts

key-decisions:
  - "Admins cannot deactivate themselves (API-level guard)"
  - "100-year ban duration for effectively permanent deactivation"
  - "Middleware checks is_active on every request to catch unexpired tokens"
  - "signOut wrapped in try/catch since user may not have active sessions"

patterns-established:
  - "Admin-only mutation pattern: server client for role check, admin client for privileged operations"
  - "Dual enforcement: ban_duration prevents refresh, middleware catches unexpired tokens"
  - "Redirect with reason query param: /login?reason=deactivated"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 30 Plan 01: User Deactivation Backend Summary

**Admin API routes for user deactivation/reactivation with ban enforcement and middleware-level is_active checking on every protected request**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T10:31:21Z
- **Completed:** 2026-02-10T10:34:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /api/admin/deactivate-user sets is_active=false, bans user for 100 years, kills all sessions
- POST /api/admin/reactivate-user sets is_active=true, unbans user
- Middleware checks is_active on every protected request and redirects deactivated users
- Self-deactivation guard prevents admins from locking themselves out

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deactivate and reactivate API routes** - `9308dcc` (feat)
2. **Task 2: Enhance middleware to check is_active status** - `d9cafa3` (feat)

## Files Created/Modified
- `app/api/admin/deactivate-user/route.ts` - POST endpoint requiring admin role, guards against self-deactivation, sets is_active=false, bans via Supabase Admin API for 100 years, kills active sessions
- `app/api/admin/reactivate-user/route.ts` - POST endpoint requiring admin role, sets is_active=true, unbans via Supabase Admin API
- `lib/supabase/middleware.ts` - Added is_active check on every protected request, signs out and redirects deactivated users to /login?reason=deactivated

## Decisions Made

**1. Self-deactivation guard at API level**
- Admins cannot deactivate their own account
- Prevents accidental lockout
- Guard placed before database operations in deactivate-user route

**2. 100-year ban duration for permanent deactivation**
- Supabase Admin API ban_duration set to "876600h" (100 years)
- Effectively permanent while still being reversible
- Prevents token refresh after expiry

**3. Middleware is_active enforcement on every request**
- Query public.users.is_active after supabase.auth.getUser()
- Catches deactivated users during 0-60 minute token validity window
- Ban_duration handles token refresh prevention after expiry
- Dual enforcement ensures immediate and long-term blocking

**4. signOut wrapped in try/catch**
- User may not have active sessions when deactivation occurs
- Error should not block the deactivation operation
- is_active flag is primary control, session termination is best-effort

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compilation and build checks passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Backend enforcement layer complete. Ready for UI implementation:
- Admin user management page can call these APIs
- Login page can display appropriate message for ?reason=deactivated
- User list page can show is_active status and provide deactivate/reactivate buttons

## Self-Check: PASSED

**Files created:**
- ✓ FOUND: app/api/admin/deactivate-user/route.ts
- ✓ FOUND: app/api/admin/reactivate-user/route.ts

**Files modified:**
- ✓ FOUND: lib/supabase/middleware.ts contains is_active check

**Commits exist:**
- ✓ FOUND: 9308dcc (Task 1: Create deactivate and reactivate API routes)
- ✓ FOUND: d9cafa3 (Task 2: Enhance middleware to check is_active status)

**Verification checks:**
- ✓ npm run type-check passed
- ✓ npm run build succeeded
- ✓ Deactivate API guards self-deactivation
- ✓ Middleware queries is_active on protected routes

---
*Phase: 30-user-deactivation*
*Completed: 2026-02-10*
