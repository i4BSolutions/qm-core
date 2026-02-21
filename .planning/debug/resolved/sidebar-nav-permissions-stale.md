---
status: resolved
trigger: "sidebar-nav-permissions-stale"
created: 2026-02-21T00:00:00Z
updated: 2026-02-21T00:20:00Z
---

## Current Focus

hypothesis: RESOLVED
test: Build and type-check both pass with zero errors
expecting: n/a
next_action: n/a — archived

## Symptoms

expected: User sees all nav items — all 16 resources set to Edit in user_permissions
actual: User only sees QMRL, Item, and Dashboard
errors: None reported
reproduction: Log in as gudakodummymail@gmail.com, check sidebar
started: After Phase 61 permission migration. Old role was "qmrl" which maps to edit on system_dashboard/qmrl/qmhq + view on po/invoice/warehouse/item + block on rest. Current nav shows even less.

## Eliminated

- hypothesis: Caching issue
  evidence: The sidebar reads `userRole` which is hardcoded to `null` in code — no cache involved
  timestamp: 2026-02-21T00:05:00Z

- hypothesis: RLS blocking the user_permissions query
  evidence: The sidebar never even queries user_permissions — it only reads userRole which is null
  timestamp: 2026-02-21T00:05:00Z

## Evidence

- timestamp: 2026-02-21T00:05:00Z
  checked: components/layout/sidebar.tsx lines 188-202
  found: |
    `const userRole = null as import("@/types").UserRole | null;`
    This is hardcoded null with a TODO comment "Phase 62: replace role-based navigation filter with permission-based check"
    The `visibleNavigation` filter hides any item with `roles` defined when `userRole` is null.
    Nav items with `roles: ["admin", "qmhq"]` etc. are hidden for everyone with null role.
  implication: The sidebar NEVER shows role-restricted items to any user. It's a dead stub.

- timestamp: 2026-02-21T00:05:00Z
  checked: components/providers/auth-provider.tsx line 421-425
  found: |
    `useUserRole()` returns `null as UserRole | null` — hardcoded null.
    Comment: "TODO Phase 62: replace with permission-based check"
    "users.role column dropped in Phase 60 — always returns null until Phase 62"
  implication: All consumers of useUserRole() — including use-permissions.ts — always get null.

- timestamp: 2026-02-21T00:06:00Z
  checked: lib/hooks/use-permissions.ts
  found: |
    `permissionMatrix` is a pure in-memory lookup keyed by the old 3-role system (admin/qmrl/qmhq).
    `hasPermission(role, ...)` returns false if role is null.
    `canAccessRoute(role, path)` returns false if role is null.
    Neither function reads from the `user_permissions` table.
    The `roleNavigation` for `qmrl` is: ["/dashboard", "/qmrl", "/item"] — exactly what the user sees!
  implication: Even if useUserRole() returned "qmrl", the user would only see 3 items.
               Since it returns null, they see only items with no roles restriction (Dashboard, QMRL, Items).

- timestamp: 2026-02-21T00:07:00Z
  checked: types/database.ts lines 2421-2458
  found: |
    `PermissionResource` type exists, `PermissionLevel` type exists, `UserPermission` interface exists.
    The new permission schema types are ready.
  implication: TypeScript types are ready; only the hooks/components need updating.

- timestamp: 2026-02-21T00:08:00Z
  checked: supabase/migrations/20260221000000_permission_schema.sql
  found: |
    `user_permissions` table exists with RLS policy:
    "users_read_own_permissions" — non-admins can SELECT their own rows (user_id = auth.uid()).
    `has_permission()` DB function reads from user_permissions using auth.uid().
  implication: The DB is ready. The frontend just needed to query user_permissions and use it.

## Resolution

root_cause: |
  Three places contained hardcoded `null` stubs left from Phase 60's role column removal,
  explicitly deferred to "Phase 62":

  1. `components/providers/auth-provider.tsx`:
     `useUserRole()` always returned null. Never read user_permissions.

  2. `components/layout/sidebar.tsx`:
     `const userRole = null` — never read useUserRole() or user_permissions.
     Filter hid ALL role-restricted nav items for null role.
     Result: only items with no `roles` field were shown (Dashboard, QMRL, Items).

  3. `lib/hooks/use-permissions.ts`:
     Used old 3-role in-memory matrix. Never queried user_permissions table.

  Net effect: Since the user's old role was "qmrl", they would have seen only Dashboard/QMRL/Item
  under the old system. With null role, they see only items with no role restriction:
  Dashboard (no roles), QMRL (no roles), Items (no roles) = exactly what was reported.

fix: |
  Implemented the Phase 62 "TODO" work for the sidebar path:

  1. components/providers/auth-provider.tsx:
     - Added `UserPermissionsMap` type (Partial<Record<PermissionResource, PermissionLevel>>)
     - Added `permissions` field to `AuthContextType`
     - Added `fetchPermissions(userId)` helper that queries user_permissions table
     - `init()` now calls `fetchProfile` and `fetchPermissions` in parallel
     - `refreshUser()` also fetches permissions in parallel with profile
     - `signOut()` clears permissions state
     - Added `useUserPermissions()` exported hook that returns the map
     - Kept `useUserRole()` stub (still returns null) for legacy call sites

  2. lib/hooks/use-permissions.ts:
     - Added import of `DbPermissionResource` and `DbPermissionLevel` from @/types (aliased
       to avoid collision with the local `PermissionResource` type used by legacy code)
     - Added `useResourcePermission(resource)` — returns level for one resource
     - Added `useCanView(resource)` — true for view or edit
     - Added `useCanEdit(resource)` — true only for edit
     - Added `useResourcePermissions()` — returns { canView, canEdit, getLevel, isAdmin, permissions }

  3. components/layout/sidebar.tsx:
     - Replaced `roles?: UserRole[]` on NavItem with `resource?: PermissionResource`
     - Each nav item now declares its DB resource key instead of allowed role names
     - Sidebar uses `useResourcePermissions()` → `canView()` to filter items
     - `userRole = null` stub removed entirely
     - Footer now shows user.full_name instead of a stale role field

verification: |
  - `npm run type-check` passes with zero errors
  - `npm run build` succeeds (all routes compile)
  - Logic: user with Edit on all 16 resources will have canView() = true for every
    resource, so all 8 operations items + admin section will be visible

files_changed:
  - components/providers/auth-provider.tsx
  - lib/hooks/use-permissions.ts
  - components/layout/sidebar.tsx
