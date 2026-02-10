# Phase 30: User Deactivation - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can deactivate and reactivate user accounts from the user management page. Deactivated users cannot log in, are filtered out of assignment dropdowns, but their historical data attribution is preserved. No changes to role management or user creation flow.

</domain>

<decisions>
## Implementation Decisions

### Deactivation UX
- Trigger via action menu button (... menu or action dropdown) on each user row, not a toggle switch
- Confirmation dialog required with optional reason field ("Why are you deactivating this user?")
- Deactivated users shown mixed with active users in the same list, with an "Inactive" badge
- Deactivated user rows are visually dimmed/grayed out AND show the "Inactive" badge — immediately obvious
- Admins cannot deactivate their own account — blocked to prevent lockout

### Login blocking
- Deactivation forces immediate logout of all active sessions
- Deactivated users see a specific message: "Your account has been deactivated. Contact your administrator."
- Login page distinguishes between "user not found" and "user deactivated" with different error messages (deactivated gets the specific message above)

### Claude's Discretion
- Dropdown filtering approach (how deactivated users are hidden in assignment selects but visible in historical records)
- Reactivation flow (same action menu, confirmation dialog style)
- Database implementation (is_active flag, middleware check approach)
- Session invalidation mechanism (Supabase auth approach)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing patterns in the user management page.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-user-deactivation*
*Context gathered: 2026-02-10*
