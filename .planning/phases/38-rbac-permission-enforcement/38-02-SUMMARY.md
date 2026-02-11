---
phase: 38-rbac-permission-enforcement
plan: 02
subsystem: rbac
tags: [rbac, roles, permissions, page-guards, ui]
dependency_graph:
  requires:
    - 38-01 (RBAC infrastructure with 3-role system)
  provides:
    - Page-level role checks updated to 3-role model
    - Server-side page guard for /qmhq/* routes
    - Admin-only file deletion enforcement
    - Admin-only stock-out approval enforcement
  affects:
    - All pages using role checks or role display
    - User management and dashboard
tech_stack:
  added: []
  patterns:
    - Server-side layout guard for route protection
    - Role-based redirect logic
    - Permission-based UI rendering
key_files:
  created:
    - app/(dashboard)/qmhq/layout.tsx
  modified:
    - app/(dashboard)/dashboard/page.tsx
    - app/(dashboard)/admin/users/page.tsx
    - app/(dashboard)/admin/users/user-dialog.tsx
    - app/api/admin/invite-user/route.ts
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
decisions:
  - decision: Use server-side layout for /qmhq route group protection
    rationale: Next.js layouts wrap all child routes, providing comprehensive protection without per-page guards
    alternatives: Per-page guards (more duplication, easier to miss a page)
  - decision: Remove isQuartermaster check from PO edit logic
    rationale: 3-role model has no quartermaster role; permission matrix grants CRUD to admin and qmhq
    alternatives: Create new admin-only restriction (not aligned with permission matrix)
metrics:
  duration: 305s
  completed: 2026-02-11T19:28:21Z
---

# Phase 38 Plan 02: Page-Level 3-Role Migration Summary

Updated all page-level role checks, role display configurations, and hardcoded role strings to use the 3-role model (admin, qmrl, qmhq), completing the RBAC enforcement migration.

## What Was Done

### Task 1: Dashboard and Admin User Management Pages (Commit fb0fe3b)

**Files modified:**
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/admin/users/page.tsx`
- `app/(dashboard)/admin/users/user-dialog.tsx`
- `app/api/admin/invite-user/route.ts`

**Changes:**
1. **Dashboard redirect logic**: Removed `roleRedirectMap` with 5 old roles, replaced with inline logic: qmhq → /qmhq, others → /qmrl
2. **Admin users page roleConfig**: Replaced 7-role badge config with 3-role config (Admin/QMRL/QMHQ)
3. **Stats cards**: Updated from 4 cards (Total, Admins, Quartermasters, Staff) to 4 cards (Total, Admins, QMRL Users, QMHQ Users)
4. **User dialog role options**: Replaced 7 role options with 3 role options
5. **Default role fallbacks**: Changed all "requester" defaults to "qmrl" (3 locations across files)
6. **Invite user API**: Default role changed from "requester" to "qmrl"

### Task 2: Server-Side QMHQ Page Guard (Commit edc59d6)

**Files created:**
- `app/(dashboard)/qmhq/layout.tsx`

**Changes:**
1. Created server-side layout for /qmhq route group
2. RBAC-07 enforcement: Redirects QMRL users to /dashboard
3. Applies to ALL /qmhq child routes: list, detail, new, edit
4. Admin and QMHQ users pass through to child pages

**Why a layout?** Next.js layouts wrap all child routes. By placing the guard in the layout, every /qmhq/* route is protected without modifying individual page files. This is the cleanest server-side enforcement pattern.

### Task 3: Page-Level Role Check Updates (Commit 76730df)

**Files modified:**
- `app/(dashboard)/qmrl/[id]/page.tsx`
- `app/(dashboard)/qmhq/[id]/page.tsx`
- `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`
- `app/(dashboard)/po/[id]/page.tsx`

**Changes:**
1. **QMRL detail file delete**: Changed from `admin || quartermaster` to `admin` only
2. **QMHQ detail file delete**: Changed from `admin || quartermaster` to `admin` only
3. **Stock-out approval (RBAC-15)**:
   - `canApprove`: Changed from `admin || quartermaster || inventory` to `admin` only
   - `canExecute`: Changed from `admin || inventory` to `admin` only
4. **PO detail**: Removed `isQuartermaster` check (no longer exists in 3-role permission system)

**Note on requester references:** Database field names like `requester_id`, `requester?.full_name`, and Supabase join syntax `requester:users!` were NOT changed — these refer to the person who created a request (entity field name), not a role value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] PO detail page TypeScript error**
- **Found during:** Task 3 verification
- **Issue:** `isQuartermaster` property no longer exists on usePermissions() hook return type (was removed in Plan 01)
- **Fix:** Removed `isQuartermaster` destructuring and the `!isQuartermaster` check from showEditButton logic
- **Rationale:** 3-role permission matrix grants CRUD on purchase_orders to both admin and qmhq; no need for additional restriction
- **Files modified:** `app/(dashboard)/po/[id]/page.tsx`
- **Commit:** 76730df (included in Task 3 commit)

## Verification Results

### Type-Check
```bash
npm run type-check
```
✅ **PASSED** - Zero TypeScript errors across entire project

### Production Build
```bash
npm run build
```
✅ **PASSED** - Build completed successfully

### Old Role String Checks
```bash
grep -rn '"quartermaster"\|"frontline"' app/ lib/ components/ types/
```
✅ **PASSED** - No old role strings found

```bash
grep -rn '"requester"' app/ lib/ components/ types/ | grep -v "requester_id\|requester:users\|requester?\."
```
✅ **PASSED** - Only database field references remain (not role assignments)

### RBAC Enforcement
- ✅ RBAC-07: Server-side page guard at `app/(dashboard)/qmhq/layout.tsx` blocks QMRL users from all /qmhq/* routes
- ✅ RBAC-14: Admin retains full CRUD (verified via permission matrix in Plan 01)
- ✅ RBAC-15: Stock-out approval restricted to admin only (`canApprove` and `canExecute` checks)

## Self-Check: PASSED

### Created Files
- ✅ `app/(dashboard)/qmhq/layout.tsx` exists

### Modified Files
All files modified as planned:
- ✅ `app/(dashboard)/dashboard/page.tsx`
- ✅ `app/(dashboard)/admin/users/page.tsx`
- ✅ `app/(dashboard)/admin/users/user-dialog.tsx`
- ✅ `app/api/admin/invite-user/route.ts`
- ✅ `app/(dashboard)/qmrl/[id]/page.tsx`
- ✅ `app/(dashboard)/qmhq/[id]/page.tsx`
- ✅ `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`
- ✅ `app/(dashboard)/po/[id]/page.tsx`

### Commits
- ✅ fb0fe3b: Task 1 - Dashboard and admin pages
- ✅ edc59d6: Task 2 - QMHQ layout guard
- ✅ 76730df: Task 3 - Page-level role checks

## Impact

### User Experience
- **Dashboard**: Non-admin users are immediately redirected to their primary workspace (qmrl or qmhq)
- **Admin pages**: Role badges and statistics now show 3 clear categories instead of 7 fragmented ones
- **User creation**: Cleaner role selection with 3 focused options instead of 7 overlapping ones
- **File deletion**: Simplified permission model (admin or owner)
- **Stock-out approval**: Clear admin-only control (RBAC-15)

### Code Quality
- **Reduced complexity**: Removed roleRedirectMap with 5 entries, replaced with inline logic
- **Type safety**: All TypeScript errors resolved, full type-check passes
- **Consistency**: All role checks now use 3-role model uniformly
- **Security**: Server-side layout guard ensures RBAC-07 enforcement cannot be bypassed

### Technical Debt Removed
- ✅ Removed all references to old 7-role system in page components
- ✅ Removed obsolete `isQuartermaster` permission flag
- ✅ Simplified role-based redirect logic

## Migration Safety

### Backward Compatibility
- ⚠️ **BREAKING**: Users with old roles (quartermaster, finance, inventory, proposal, frontline, requester) cannot log in until database migration completes
- ✅ Database migration (Phase 37) was completed prior to this deployment
- ✅ All users in production now have one of 3 roles (admin, qmrl, qmhq)

### Rollback Plan
If issues arise:
1. Revert commits: 76730df, edc59d6, fb0fe3b
2. Revert Plan 01 commit (38-01)
3. Redeploy previous version
4. Database state remains valid (enum still has all 7 old values + 3 new values until old column drop)

## Next Steps

1. **Phase 38 Plan 03** (if exists): Additional RBAC enforcement or cleanup
2. **Phase 39**: Flow Tracking implementation (uses new admin role)
3. **Production deployment**: Deploy Phase 38 (Plans 01-02) atomically with maintenance window
4. **Monitoring**: Verify RBAC-07 enforcement (no QMRL users accessing /qmhq routes)

## Notes

### requester vs "requester"
- **Database field names** like `requester_id`, `requester?.full_name`, `requester:users!` were NOT changed
- These refer to the person who created a request (entity field name), not a role value
- Only role assignment strings like `role: "requester"` were changed to `role: "qmrl"`

### Server-Side vs Client-Side Enforcement
- **Server-side layout guard** (`app/(dashboard)/qmhq/layout.tsx`): Blocks navigation at server level
- **Navigation filtering** (Plan 01): Hides nav links client-side
- **Permission checks** (Plan 01): Controls UI element visibility
- **Defense-in-depth**: All 3 layers work together to enforce RBAC-07

### Default Role Choice
- Default role changed from "requester" to "qmrl" (equivalent in 3-role system)
- Aligns with Phase 37 database migration where `requester` → `qmrl`
- New user invites default to "qmrl" (most common user type)
