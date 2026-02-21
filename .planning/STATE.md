# State: QM System

**Last Updated:** 2026-02-21 (61-01 complete)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** v1.13 Permission Matrix & Auto Status — Phase 61 Plan 01 complete (Permission Matrix UI)

---

## Current Position

Phase: 61 of 64 (Permission Management UI)
Plan: 01 — COMPLETE
Status: Phase 61 Plan 01 done — permission matrix UI shipped
Last activity: 2026-02-21 — Phase 61 plan 01 executed (PermissionMatrix + PermissionsTab + user-dialog cleanup)

Progress: [█████████████████████░░] 60/64 phases complete

---

## Performance Metrics

**Codebase:**
- ~54,047 lines of TypeScript (+ role references removed/TODO'd)
- 78 database migrations (1 new: RLS permission matrix rewrite)
- 102 RLS policies across 25 tables (rewritten to use has_permission())

**Shipped Milestones:**
- 13 milestones shipped (v1.0 through v1.12)
- 60 phases, 148 plans total delivered

**v1.13 Scope:**
- 6 phases (59-64), phases 59+60 complete
- 24 requirements (11 PERM, 9 AUTO, 4 DASH)

---

## Accumulated Context

### Key Decisions from Phase 61 Plan 01

- **user_permissions table added to Database type** — `types/database.ts` now includes full Row/Insert/Update types and `permission_resource`/`permission_level` enums, enabling typed Supabase client access from the UI
- **Dialog modal (700px) for permissions UI** — no dedicated `/admin/users/[id]` page exists; modal is the equivalent of a "Permissions tab" as noted in the plan objective
- **window.confirm() for Set All** — keeps component complexity minimal; matches existing pattern in codebase (reactivate confirmation)
- **Atomic upsert for all 16 rows** — `onConflict: 'user_id,resource'` ensures idempotent save regardless of existing state

### Key Decisions for v1.13

- Permission matrix is per-user per-resource (16 resources, updated from 15), not role-based groups
- Edit = CRUD, View = read-only, Block = no access
- Admin lockout prevention: admin cannot remove their own Admin resource Edit permission
- Auto status is computed (VIEW or trigger), not stored — derived from child record state
- Dashboard becomes a QMRL list; all existing KPI sections removed entirely
- Phase 60 (RLS rewrite) is the heaviest lift — 100 policies across 22 tables

### Key Decisions from Phase 59

- **users.role column preserved in Phase 59** — NOT dropped until Phase 60 rewrites 100+ RLS policies. Dropping now would break all authorization.
- **Fail-closed default**: missing permission row = block, not an error. Both `check_user_permission()` and `has_permission()` implement this.
- **has_permission(resource, level)** function created for Phase 60 RLS use — takes auth.uid() automatically
- **check_user_permission(user_id, resource)** function for server-side/admin queries
- **create_default_permissions(user_id)** is idempotent (ON CONFLICT DO NOTHING)
- **Inactive users** get all-block permissions for referential integrity
- **Validation block** in data migration raises exception if any user has fewer than 16 rows

### Key Decisions from Phase 60

- **102 RLS policies** across 25 tables rewritten to use `has_permission(resource, level)`
- **Recursion-safe user_permissions policies**: use direct `EXISTS` subquery instead of `has_permission()` to avoid circular dependency
- **Cross-cutting tables** (file_attachments, comments) use `attachment_entity_resource()` and `comment_entity_resource()` IMMUTABLE helpers to map `entity_type` text to `permission_resource` enum
- **stock_out_approvals** uses OR across sor_l1/sor_l2/sor_l3 for SELECT/INSERT/UPDATE; DELETE is admin-only
- **users.role column, user_role enum, get_user_role() dropped** — all RLS now uses permission matrix
- **UserRole TypeScript type kept as deprecated alias** (string union) for Phase 62 compatibility — not removed to avoid 15+ compile errors
- **Frontend role checks disabled with TODO Phase 62** — useUserRole() returns null, middleware role guards commented out, role-based redirects removed

### Phase Dependency Order

```
59 (Schema) → 60 (RLS) → 62 (Frontend enforcement)
59 (Schema) → 61 (Permission UI)
58 (v1.12 done) → 63 (Auto Status)
60 + 61 + 63 → 64 (Dashboard)
```

Note: Phase 63 (Auto Status) can run in parallel with 60-62 if needed.

### Blockers

**None**

---

## Session Continuity

**What Just Happened:**
- Phase 61 Plan 01 executed: Permission Matrix UI — PermissionMatrix component + PermissionsTab + user management page cleanup
- `components/admin/permission-matrix.tsx` — 16-resource grid, dirty-state indicators, Set All buttons, lockout support
- `app/(dashboard)/admin/users/permissions-tab.tsx` — fetches/saves permissions, atomic upsert, admin lockout prevention
- `app/(dashboard)/admin/users/page.tsx` — Permissions modal added, stale role stat cards removed, role column removed from table
- `app/(dashboard)/admin/users/user-dialog.tsx` — role dropdown removed, department spans full width
- `types/database.ts` — user_permissions table + permission_resource/level enums added
- Commits: fa26da7 (PermissionMatrix component), be368bf (PermissionsTab + page integration + DB types)

**Context for Next Agent (Phase 61 Plan 02 or Phase 62):**
- `user_permissions` table fully typed in TypeScript (Row/Insert/Update + enums in Database type)
- Permission matrix component at `components/admin/permission-matrix.tsx` is reusable (accept props, no Supabase)
- PermissionsTab wired to existing admin/users page — admin can manage any user's 16 permissions
- Role dropdown removed from user edit dialog — new user permission assignment pending Plan 02
- Phase 62 (Frontend enforcement) still needed to wire `usePermissions()` to actual DB checks

**Resume at:** Phase 61 Plan 02 (or Phase 62 if Plan 02 doesn't exist)

---

*State last updated: 2026-02-21 after Phase 61 Plan 01 complete*
