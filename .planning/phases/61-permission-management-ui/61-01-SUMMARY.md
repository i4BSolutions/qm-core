---
phase: 61-permission-management-ui
plan: "01"
subsystem: admin-permissions
tags: [permission-matrix, user-management, rbac, admin-ui]
dependency_graph:
  requires: [59-01, 60-01]
  provides: [permission-matrix-ui, permissions-tab, user-dialog-cleanup]
  affects: [admin/users]
tech_stack:
  added: []
  patterns:
    - "Controlled component permission matrix with dirty-state tracking"
    - "Supabase upsert with onConflict for atomic 16-row permission save"
    - "Admin lockout prevention via disabledResources prop"
    - "Database type augmentation for user_permissions table"
key_files:
  created:
    - components/admin/permission-matrix.tsx
    - app/(dashboard)/admin/users/permissions-tab.tsx
  modified:
    - app/(dashboard)/admin/users/page.tsx
    - app/(dashboard)/admin/users/user-dialog.tsx
    - types/database.ts
key_decisions:
  - "user_permissions table added to Database type in types/database.ts to enable typed Supabase client access"
  - "Dialog modal (700px) used for permissions UI — equivalent to a tab in the absence of a dedicated user detail page"
  - "window.confirm() used for Set All confirmation to minimize component complexity"
  - "permission_resource and permission_level enums added to Database.public.Enums"
metrics:
  duration_seconds: 698
  tasks_completed: 2
  files_modified: 5
  completed_date: "2026-02-21"
---

# Phase 61 Plan 01: Permission Management UI Summary

Permission matrix component and PermissionsTab wired into user management page; role dropdown removed from user edit dialog; stale role stat cards removed.

## What Was Built

### Task 1: PermissionMatrix Component
`components/admin/permission-matrix.tsx` — a pure presentational/controlled component rendering all 16 permission resources as a grid with Edit/View/Block radio buttons.

Key features:
- Sticky header row with Edit/View/Block column labels
- Dirty row highlighting: `bg-amber-500/5 border-l-2 border-l-amber-500` plus amber dot indicator
- Disabled row support (opacity-60) with Tooltip explaining lockout prevention
- Set All buttons (Edit/View/Block) — calls `onSetAll` prop if provided, or falls back to iterating `onChange` for each resource
- Create mode: unset rows shown at `opacity-70`
- Native HTML radio inputs with Tailwind `accent-*` colors (no shadcn RadioGroup needed)

### Task 2: PermissionsTab + Page Integration
`app/(dashboard)/admin/users/permissions-tab.tsx` — client component that fetches, displays, and saves permissions for a specific user.

Key features:
- Fetches all 16 `user_permissions` rows on mount; builds `Record<PermissionResource, PermissionLevel>` with block fallback for missing rows
- Tracks `initialPermissions` snapshot and `currentPermissions` live edits; computes `dirtyResources` set via comparison
- Admin lockout: when `isSelf`, adds `'admin'` to `disabledResources` and shows amber warning banner
- Set All: `window.confirm()` dialog with level name, then bulk-updates all non-disabled resources
- Save All: upserts all 16 rows atomically via `supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,resource' })`
- `beforeunload` event listener when dirty; removed on cleanup
- Success toast names the user: "Permissions updated for [userName]"

`app/(dashboard)/admin/users/page.tsx` updates:
- Added `permissionsOpen` + `selectedUserForPermissions` state
- Added `handleOpenPermissions` and `handlePermissionsClose` handlers
- Added "Permissions" DropdownMenuItem with Shield icon (visible when `canUpdate`)
- Permissions Dialog rendered as `sm:max-w-[700px]` modal
- Removed 3 stale role stat cards (Admin / QMRL Users / QMHQ Users — all showing 0 since Phase 60 dropped role column)
- Kept single Total Users card with Active/Inactive split
- Removed role column from DataTable

`app/(dashboard)/admin/users/user-dialog.tsx` updates:
- Removed `role` field from formData state
- Removed `roles` constant and `UserRole` local type
- Removed role `Select` dropdown from form
- Department field now spans full width (no grid-cols-2)
- Removed `role` from invite-user API call body

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] user_permissions table missing from TypeScript Database type**
- **Found during:** Task 2 type-check
- **Issue:** `types/database.ts` did not include the `user_permissions` table or the `permission_resource`/`permission_level` enums in the `Database` type. The Supabase typed client rejected `supabase.from('user_permissions')` with a TypeScript error: `Argument of type '"user_permissions"' is not assignable to parameter of type ...`.
- **Fix:** Added `user_permissions` table Row/Insert/Update/Relationships to `Database.public.Tables`, and added `permission_resource` and `permission_level` enums to `Database.public.Enums`.
- **Files modified:** `types/database.ts`
- **Commit:** be368bf (included with Task 2 commit)

## Self-Check: PASSED

All created/modified files verified to exist on disk. All task commits verified in git log:
- `fa26da7` — feat(61-01): create reusable PermissionMatrix component
- `be368bf` — feat(61-01): integrate PermissionsTab into user management page
