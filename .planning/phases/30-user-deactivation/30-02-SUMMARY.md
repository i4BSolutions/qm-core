---
phase: 30-user-deactivation
plan: 02
subsystem: ui, auth
tags: [admin-ui, user-management, deactivation-dialog, login-redirect]

# Dependency graph
requires:
  - phase: 30-user-deactivation-01
    provides: Deactivation/reactivation API routes and middleware enforcement
  - phase: 03-authentication
    provides: Login page and auth flow
provides:
  - Admin UI for deactivating/reactivating users with confirmation dialog
  - Visual indicators for inactive users (badges, dimmed rows)
  - Deactivation-specific login error message
  - Consistent user dropdown filtering across forms
affects: [admin-user-management, login-flow, user-assignment-dropdowns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional reason field pattern (differs from VoidInvoiceDialog which requires reason)"
    - "Self-deactivation UI guard (hide action for current user's row)"
    - "URL search param pattern for login error messages"
    - "Suspense wrapper for useSearchParams in App Router"

key-files:
  created:
    - app/(dashboard)/admin/users/deactivate-user-dialog.tsx
  modified:
    - app/(dashboard)/admin/users/page.tsx
    - app/(auth)/login/page.tsx
    - app/(dashboard)/qmhq/new/page.tsx
    - app/(dashboard)/qmhq/[id]/edit/page.tsx

key-decisions:
  - "Reason field is optional for user deactivation (unlike invoice voiding)"
  - "Reactivation uses simple window.confirm, no custom dialog needed"
  - "Stats card shows 'X Active / Y Inactive' split for visibility"
  - "Admin users page shows ALL users (no is_active filter) for full visibility"

patterns-established:
  - "Inactive user visual pattern: opacity-50 on all row cells + Inactive badge"
  - "Action menu conditional rendering: Deactivate for active, Reactivate for inactive"
  - "Self-action prevention: Hide Deactivate when row.original.id === currentUser?.id"
  - "Standardized filtering: .eq('is_active', true) for all user dropdowns"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 30 Plan 02: User Deactivation UI Summary

**Admin users page with deactivation dialog, inactive user indicators, login error message, and consistent dropdown filtering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-10T10:36:35Z
- **Completed:** 2026-02-10T10:41:00Z (estimated)
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- DeactivateUserDialog component with optional reason field
- Users page shows all users (active + inactive) with visual indicators
- Inactive users have dimmed rows and "Inactive" badge
- Action menu shows Deactivate (with dialog) for active users, Reactivate for inactive
- Admin cannot deactivate their own account (UI-level guard)
- Login page shows deactivation-specific message on ?reason=deactivated redirect
- All user dropdowns consistently use .eq("is_active", true) filtering
- Stats card updated to show "X Active / Y Inactive"

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deactivation confirmation dialog and update users page** - `f991739` (feat)
2. **Task 2: Update login page with deactivation-specific error message** - `7b7f985` (feat)
3. **Task 3: Audit and fix user dropdown filtering consistency** - `0163277` (refactor)

## Files Created/Modified
- `app/(dashboard)/admin/users/deactivate-user-dialog.tsx` - Confirmation dialog with optional reason field, warning banner, follows VoidInvoiceDialog pattern but reason is optional
- `app/(dashboard)/admin/users/page.tsx` - Removed .neq("is_active", false) filter to show all users, added inactive badges and dimmed rows, action menu with conditional Deactivate/Reactivate, self-deactivation guard, updated stats
- `app/(auth)/login/page.tsx` - Added useSearchParams to detect reason=deactivated, shows error message "Your account has been deactivated. Contact your administrator.", wrapped in Suspense for App Router
- `app/(dashboard)/qmhq/new/page.tsx` - Changed .neq("is_active", false) to .eq("is_active", true) for consistency
- `app/(dashboard)/qmhq/[id]/edit/page.tsx` - Changed .neq("is_active", false) to .eq("is_active", true) for consistency

## Decisions Made

**1. Optional reason field for deactivation**
- Unlike VoidInvoiceDialog which requires a reason, deactivation reason is optional
- Field labeled "Why are you deactivating this user? (optional)"
- Empty reason sent as undefined to API

**2. Simple confirmation for reactivation**
- Reactivation uses window.confirm() instead of custom dialog
- Simpler flow since reactivation is less critical than deactivation
- Message: "Reactivate {userName}? They will be able to log in again."

**3. Admin users page shows ALL users**
- Removed .neq("is_active", false) filter entirely
- Admins need visibility into all users (active + inactive)
- Inactive users clearly marked with badge and dimming

**4. Stats card split display**
- Changed from "Total Users" with single count
- Now shows "X Active / Y Inactive" for immediate status visibility
- Helps admins understand deactivation impact at a glance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compilation and build checks passed on first attempt.

## User Setup Required

None - UI changes only, backend already deployed in plan 01.

## Next Phase Readiness

User deactivation feature complete. Phase 30 finished. Ready for Phase 31 (Context Panel Refactoring).

Full deactivation flow:
1. Admin opens action menu on user row
2. Clicks Deactivate (hidden for own row)
3. Dialog shows with optional reason field
4. Confirms → API call → user's sessions killed, token banned
5. Middleware catches user on next request → redirects to /login?reason=deactivated
6. Login page shows "Your account has been deactivated. Contact your administrator."
7. Admin can reactivate via action menu → simple confirm → API call
8. User can log in again

## Self-Check: PASSED

**Files created:**
- ✓ FOUND: app/(dashboard)/admin/users/deactivate-user-dialog.tsx

**Files modified:**
- ✓ FOUND: app/(dashboard)/admin/users/page.tsx contains DeactivateUserDialog import
- ✓ FOUND: app/(dashboard)/admin/users/page.tsx shows all users (no is_active filter)
- ✓ FOUND: app/(dashboard)/admin/users/page.tsx has Inactive badge rendering
- ✓ FOUND: app/(auth)/login/page.tsx contains deactivation message
- ✓ FOUND: app/(auth)/login/page.tsx uses useSearchParams
- ✓ FOUND: app/(dashboard)/qmhq/new/page.tsx uses .eq("is_active", true)
- ✓ FOUND: app/(dashboard)/qmhq/[id]/edit/page.tsx uses .eq("is_active", true)

**Commits exist:**
- ✓ FOUND: f991739 (Task 1: Create deactivation confirmation dialog and update users page)
- ✓ FOUND: 7b7f985 (Task 2: Update login page with deactivation-specific error message)
- ✓ FOUND: 0163277 (Task 3: Audit and fix user dropdown filtering consistency)

**Verification checks:**
- ✓ npm run type-check passed
- ✓ npm run build succeeded
- ✓ DeactivateUserDialog component exists with 60+ lines
- ✓ Login page contains "deactivated" keyword
- ✓ Users page contains "is_active" check
- ✓ grep confirms no .neq("is_active", false) in user-related queries

---
*Phase: 30-user-deactivation*
*Completed: 2026-02-10*
