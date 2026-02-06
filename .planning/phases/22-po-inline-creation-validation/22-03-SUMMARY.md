---
phase: 22-po-inline-creation-validation
plan: 03
subsystem: auth
tags: [authentication, session-management, multi-tab, BroadcastChannel, visibility-api]

# Dependency graph
requires:
  - phase: 03-authentication
    provides: Auth provider with Supabase session management
provides:
  - Tab visibility session refresh with silent validation
  - Cross-tab logout synchronization via BroadcastChannel
  - Unsaved work warning modal for expired sessions
affects: [all phases with draft/unsaved data in sessionStorage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab visibility handling with document.visibilitychange"
    - "Cross-tab messaging via BroadcastChannel with Safari fallback"
    - "Unsaved work detection via sessionStorage keys"

key-files:
  created: []
  modified:
    - components/providers/auth-provider.tsx

key-decisions:
  - "Use visibilitychange event for tab focus detection instead of polling"
  - "BroadcastChannel with graceful Safari degradation (no localStorage fallback)"
  - "Session expired modal offers Stay on Page option to preserve unsaved data visibility"
  - "Check for unsaved work in qmhq_draft, qmhq_route_data, po_draft keys"

patterns-established:
  - "checkForUnsavedWork helper to detect draft data in sessionStorage"
  - "re-entrancy guard (isRefreshing flag) to prevent race conditions"
  - "Dialog with onPointerDownOutside prevention for critical modals"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 22 Plan 03: Multi-Tab Session Handling Summary

**Session auto-refresh on tab focus with cross-tab logout sync via BroadcastChannel and unsaved work warning modal**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T15:24:17Z
- **Completed:** 2026-02-06T15:27:35Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Tab visibility event listener refreshes session silently when user returns to inactive tab
- Cross-tab logout synchronization broadcasts signout to all open tabs
- Session expired modal warns users about unsaved work before forcing logout
- Graceful degradation for Safari (no BroadcastChannel support)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tab visibility session refresh** - `c30525c` (feat)
2. **Task 2: Add cross-tab logout synchronization** - `997c31c` (feat)

## Files Created/Modified
- `components/providers/auth-provider.tsx` - Added visibilitychange listener, BroadcastChannel sync, unsaved work modal

## Decisions Made

**1. Use visibilitychange event for tab focus detection**
- Rationale: More efficient than polling, fires exactly when tab becomes visible
- Alternative considered: setInterval polling (rejected - wasteful)

**2. BroadcastChannel with Safari fallback, no localStorage implementation**
- Rationale: Safari users work normally without cross-tab sync (per user decision)
- Alternative considered: localStorage fallback with storage event (rejected - additional complexity not worth it)

**3. Session expired modal offers "Stay on Page" option**
- Rationale: User can manually copy unsaved data before losing it
- Note: Session is already invalid, so API calls will fail, but data remains visible

**4. Check specific sessionStorage keys for unsaved work**
- Keys checked: qmhq_draft, qmhq_route_data, po_draft
- Rationale: These are the keys where draft data is stored during create flows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Multi-tab session handling complete
- Ready for PO inline creation and validation features
- Cross-tab auth sync ensures consistent user experience across tabs
- Unsaved work protection prevents data loss on session expiry

---
*Phase: 22-po-inline-creation-validation*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files and commits verified successfully.
